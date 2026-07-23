import { getLatestCustomerHealthUnified } from "@/lib/health/assessment-repository";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { loadPortalHomeCarePlan } from "@/lib/membership/portal-home-care-plan";
import { getMemberPortalDataByAccess } from "@/lib/persistence/queries/member-portal";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import type { CustomerHealthView } from "@/lib/health/types";

export interface MemberPortalPageModel {
  planData: HomeCarePlanData;
  portalData: MemberPortalData | null;
  homeownerSlug: string;
  propertySlug: string;
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  homeHealth: CustomerHealthView | null;
  homeHealthHref: string;
  portalBasePath: string;
  customerPortalMode: "token" | "slug";
}

export async function loadMemberPortalPageBySlugs(
  homeownerSlug: string,
  propertySlug: string,
): Promise<MemberPortalPageModel | null> {
  void homeownerSlug;
  void propertySlug;
  return null;
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
  const planData = await loadPortalHomeCarePlan(access);
  if (!planData) return null;

  const portalData = await getMemberPortalDataByAccess(access);
  if (
    !portalData ||
    portalData.membershipId !== access.membershipId ||
    portalData.property.id !== access.propertyId
  ) {
    return null;
  }

  const homeHealth = await getLatestCustomerHealthUnified(access.propertyId);

  return {
    planData,
    portalData,
    homeownerSlug: access.homeownerSlug,
    propertySlug: access.propertySlug,
    membershipId: access.membershipId,
    homeownerId: access.homeownerId,
    propertyId: access.propertyId,
    homeHealth,
    homeHealthHref: `${portalBasePath}/home-health`,
    portalBasePath,
    customerPortalMode: "token",
  };
}
