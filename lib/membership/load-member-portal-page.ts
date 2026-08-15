import { getLatestCustomerHealthUnified } from "@/lib/health/assessment-repository";
import { getPropertyIdBySlugs } from "@/lib/health/repository";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { loadPortalHomeCarePlan } from "@/lib/membership/portal-home-care-plan";
import { getMemberPortalDataBySlugs } from "@/lib/persistence/queries/member-portal";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import type { CustomerHealthView } from "@/lib/health/types";
import type { PortalHouseholdSnapshot } from "@/lib/membership/portal-household";

export interface MemberPortalPageModel {
  planData: HomeCarePlanData;
  portalData: MemberPortalData | null;
  homeownerSlug: string;
  propertySlug: string;
  homeHealth: CustomerHealthView | null;
  homeHealthHref: string;
  portalBasePath: string;
  customerPortalMode: "token" | "slug";
  portalHousehold: PortalHouseholdSnapshot | null;
}

export async function loadMemberPortalPageBySlugs(
  homeownerSlug: string,
  propertySlug: string,
  options?: { portalBasePath?: string; customerPortalMode?: "token" | "slug" },
): Promise<MemberPortalPageModel | null> {
  const planData =
    (await loadPortalHomeCarePlan(homeownerSlug, propertySlug)) ?? null;

  if (!planData) {
    return null;
  }

  const portalBasePath =
    options?.portalBasePath ??
    `/homecare/${homeownerSlug}/${propertySlug}/portal`;
  const customerPortalMode = options?.customerPortalMode ?? "slug";

  const portalData = isCloudPersistenceConnected()
    ? await getMemberPortalDataBySlugs(homeownerSlug, propertySlug, {
        includeLiveService: customerPortalMode === "token",
      })
    : null;

  const propertyId = await getPropertyIdBySlugs(homeownerSlug, propertySlug);
  const homeHealth = propertyId
    ? await getLatestCustomerHealthUnified(propertyId)
    : null;

  const homeHealthHref =
    customerPortalMode === "token"
      ? `${portalBasePath}/home-health`
      : `/homecare/${homeownerSlug}/${propertySlug}/portal/home-health`;

  return {
    planData,
    portalData,
    homeownerSlug,
    propertySlug,
    homeHealth,
    homeHealthHref,
    portalBasePath,
    customerPortalMode,
    portalHousehold: null,
  };
}

export async function loadMemberPortalPageByToken(
  token: string,
): Promise<MemberPortalPageModel | null> {
  const { resolvePortalAccessByToken } = await import(
    "@/lib/persistence/queries/portal-access"
  );
  const access = await resolvePortalAccessByToken(token);
  if (!access) return null;

  const portalBasePath = `/portal/${encodeURIComponent(access.portalAccessToken)}`;

  const model = await loadMemberPortalPageBySlugs(
    access.homeownerSlug,
    access.propertySlug,
    {
      portalBasePath,
      customerPortalMode: "token",
    },
  );
  if (!model) return null;

  try {
    const { loadPortalHouseholdSnapshot } = await import(
      "@/lib/persistence/queries/portal-household"
    );
    return {
      ...model,
      portalHousehold: await loadPortalHouseholdSnapshot(access),
    };
  } catch (error) {
    console.error("[member-portal] household projection unavailable", {
      membershipId: access.membershipId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return model;
  }
}
