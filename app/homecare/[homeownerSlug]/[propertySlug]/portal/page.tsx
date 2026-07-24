import {
  MemberPortalNotFound,
  MemberPortalPageClient,
} from "./member-portal-page-client";
import { loadMemberPortalPageBySlugs } from "@/lib/membership/load-member-portal-page";

interface MemberPortalPageProps {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
  }>;
}

export async function generateMetadata({ params }: MemberPortalPageProps) {
  const { homeownerSlug, propertySlug } = await params;
  return {
    manifest: `/api/portal-manifest/slug/${encodeURIComponent(homeownerSlug)}/${encodeURIComponent(propertySlug)}`,
  };
}

export default async function MemberPortalPage({ params }: MemberPortalPageProps) {
  const { homeownerSlug, propertySlug } = await params;
  const model = await loadMemberPortalPageBySlugs(homeownerSlug, propertySlug);

  if (!model) {
    return <MemberPortalNotFound />;
  }

  return (
    <MemberPortalPageClient
      planData={model.planData}
      portalData={model.portalData}
      homeownerSlug={model.homeownerSlug}
      propertySlug={model.propertySlug}
      portalBasePath={model.portalBasePath}
      customerPortalMode={model.customerPortalMode}
    />
  );
}
