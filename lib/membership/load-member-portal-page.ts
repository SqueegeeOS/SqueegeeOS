import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { loadPortalHomeCarePlan } from "@/lib/membership/portal-home-care-plan";
import { startPortalTiming } from "@/lib/observability/portal-timing";
import { getMemberPortalDataBySlugs } from "@/lib/persistence/queries/member-portal";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";

export interface MemberPortalPageModel {
  planData: HomeCarePlanData;
  portalData: MemberPortalData | null;
  homeownerSlug: string;
  propertySlug: string;
  portalBasePath: string;
  customerPortalMode: "token" | "slug";
}

interface MemberPortalPageOptions {
  portalBasePath?: string;
  customerPortalMode?: "token" | "slug";
}

async function loadMemberPortalPageBySlugsInternal(
  homeownerSlug: string,
  propertySlug: string,
  options?: MemberPortalPageOptions,
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
    ? await getMemberPortalDataBySlugs(homeownerSlug, propertySlug)
    : null;

  return {
    planData,
    portalData,
    homeownerSlug,
    propertySlug,
    portalBasePath,
    customerPortalMode,
  };
}

export async function loadMemberPortalPageBySlugs(
  homeownerSlug: string,
  propertySlug: string,
  options?: MemberPortalPageOptions,
): Promise<MemberPortalPageModel | null> {
  const timing = startPortalTiming("portal-page-load");

  try {
    const model = await loadMemberPortalPageBySlugsInternal(
      homeownerSlug,
      propertySlug,
      options,
    );
    timing.finish(model ? "success" : "not-found");
    return model;
  } catch (error) {
    timing.finish("error");
    throw error;
  }
}

export async function loadMemberPortalPageByToken(
  token: string,
): Promise<MemberPortalPageModel | null> {
  const timing = startPortalTiming("portal-token-access");
  const { resolvePortalAccessByToken } = await import(
    "@/lib/persistence/queries/portal-access"
  );
  let access;

  try {
    access = await resolvePortalAccessByToken(token);
    timing.finish(access ? "success" : "not-found");
  } catch (error) {
    timing.finish("error");
    throw error;
  }

  if (!access) return null;

  const portalBasePath = `/portal/${encodeURIComponent(access.portalAccessToken)}`;

  return loadMemberPortalPageBySlugs(
    access.homeownerSlug,
    access.propertySlug,
    {
      portalBasePath,
      customerPortalMode: "token",
    },
  );
}
