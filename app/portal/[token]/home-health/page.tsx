import type { Metadata } from "next";
import { HomeHealthPanel } from "@/components/portal/HomeHealthPanel";
import { MemberPortalNotFound } from "@/app/homecare/[homeownerSlug]/[propertySlug]/portal/member-portal-page-client";
import { loadMemberPortalPageByToken } from "@/lib/membership/load-member-portal-page";
import {
  extractVisibleCustomerNotesFromAssessments,
  listStaffAssessments,
} from "@/lib/health/assessment-repository";
import {
  extractVisibleCustomerNotes,
  getPropertyIdBySlugs,
  listStaffHealthChecks,
} from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Home Health | Member Portal",
  robots: { index: false, follow: false },
};

interface TokenHomeHealthPageProps {
  params: Promise<{ token: string }>;
}

export default async function TokenHomeHealthPage({
  params,
}: TokenHomeHealthPageProps) {
  const { token } = await params;
  const model = await loadMemberPortalPageByToken(token);

  if (!model) {
    return <MemberPortalNotFound />;
  }

  const propertyId = await getPropertyIdBySlugs(
    model.homeownerSlug,
    model.propertySlug,
  );

  const latest = model.homeHealth;
  let notes: ReturnType<typeof extractVisibleCustomerNotes> = [];

  if (propertyId) {
    const [assessments, checks] = await Promise.all([
      listStaffAssessments(propertyId),
      listStaffHealthChecks(propertyId),
    ]);
    notes = [
      ...extractVisibleCustomerNotesFromAssessments(assessments),
      ...extractVisibleCustomerNotes(checks),
    ].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }

  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <HomeHealthPanel
        latest={latest}
        notes={notes}
        propertyLabel={model.planData.property.name}
        backHref={model.portalBasePath}
      />
    </div>
  );
}
