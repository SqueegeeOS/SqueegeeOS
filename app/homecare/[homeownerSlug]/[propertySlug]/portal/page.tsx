import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence/repository";
import { getMemberPortalDataBySlugs } from "@/lib/persistence/queries/member-portal";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  MemberPortalNotFound,
  MemberPortalPageClient,
} from "./member-portal-page-client";

interface MemberPortalPageProps {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
  }>;
}

export default async function MemberPortalPage({ params }: MemberPortalPageProps) {
  const { homeownerSlug, propertySlug } = await params;

  let planData =
    (await loadGeneratedHomeCarePlan(homeownerSlug, propertySlug)) ?? null;

  if (
    !planData &&
    homeownerSlug === canyonOaksHomeCarePlan.homeowner.slug &&
    propertySlug === canyonOaksHomeCarePlan.property.slug
  ) {
    planData = canyonOaksHomeCarePlan;
  }

  if (!planData) {
    return <MemberPortalNotFound />;
  }

  const portalData =
    isCloudPersistenceConnected()
      ? await getMemberPortalDataBySlugs(homeownerSlug, propertySlug)
      : null;

  return (
    <MemberPortalPageClient
      planData={planData}
      portalData={portalData}
      homeownerSlug={homeownerSlug}
      propertySlug={propertySlug}
    />
  );
}
