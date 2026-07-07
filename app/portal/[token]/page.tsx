import type { Metadata } from "next";
import {
  MemberPortalNotFound,
  MemberPortalPageClient,
} from "@/app/homecare/[homeownerSlug]/[propertySlug]/portal/member-portal-page-client";
import { loadMemberPortalPageByToken } from "@/lib/membership/load-member-portal-page";

export const metadata: Metadata = {
  title: "Member Portal",
  robots: { index: false, follow: false },
};

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
      homeHealth={model.homeHealth}
      homeHealthHref={model.homeHealthHref}
      portalBasePath={model.portalBasePath}
      customerPortalMode={model.customerPortalMode}
    />
  );
}
