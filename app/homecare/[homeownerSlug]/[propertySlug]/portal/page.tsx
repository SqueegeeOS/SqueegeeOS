import { loadGeneratedHomeCarePlan } from "@/lib/persistence/repository";
import { getMemberPortalDataBySlugs } from "@/lib/persistence/queries/member-portal";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  getLatestCustomerHealthUnified,
} from "@/lib/health/assessment-repository";
import { getPropertyIdBySlugs } from "@/lib/health/repository";
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

  if (!planData) {
    return <MemberPortalNotFound />;
  }

  const portalData =
    isCloudPersistenceConnected()
      ? await getMemberPortalDataBySlugs(homeownerSlug, propertySlug)
      : null;

  const propertyId = await getPropertyIdBySlugs(homeownerSlug, propertySlug);
  const homeHealth = propertyId
    ? await getLatestCustomerHealthUnified(propertyId)
    : null;
  const homeHealthHref = `/homecare/${homeownerSlug}/${propertySlug}/portal/home-health`;

  return (
    <MemberPortalPageClient
      planData={planData}
      portalData={portalData}
      homeownerSlug={homeownerSlug}
      propertySlug={propertySlug}
      homeHealth={homeHealth}
      homeHealthHref={homeHealthHref}
    />
  );
}
