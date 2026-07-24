import type { Metadata } from "next";
import {
  MemberPortalNotFound,
  MemberPortalPageClient,
} from "@/app/homecare/[homeownerSlug]/[propertySlug]/portal/member-portal-page-client";
import { loadMemberPortalPageByToken } from "@/lib/membership/load-member-portal-page";

export async function generateMetadata({
  params,
}: TokenPortalPageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Member Portal",
    robots: { index: false, follow: false },
    // Per-member manifest: installing this page as an app reopens THIS portal.
    manifest: `/api/portal-manifest/${encodeURIComponent(token)}`,
  };
}

interface TokenPortalPageProps {
  params: Promise<{ token: string }>;
}

export default async function TokenPortalPage({ params }: TokenPortalPageProps) {
  const { token } = await params;
  const model = await loadMemberPortalPageByToken(token);

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
