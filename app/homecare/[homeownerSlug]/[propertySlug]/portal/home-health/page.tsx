import type { Metadata } from "next";
import { HomeHealthPanel } from "@/components/portal/HomeHealthPanel";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence/repository";
import {
  extractVisibleCustomerNotesFromAssessments,
  getLatestCustomerHealthUnified,
  listStaffAssessments,
} from "@/lib/health/assessment-repository";
import {
  extractVisibleCustomerNotes,
  getPropertyIdBySlugs,
  listStaffHealthChecks,
} from "@/lib/health/repository";
import { MemberPortalNotFound } from "../member-portal-page-client";

export const metadata: Metadata = {
  title: "Home Health | Member Portal",
  robots: { index: false, follow: false },
};

interface MemberHomeHealthPageProps {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
  }>;
}

export default async function MemberHomeHealthPage({
  params,
}: MemberHomeHealthPageProps) {
  const { homeownerSlug, propertySlug } = await params;
  const planData =
    (await loadGeneratedHomeCarePlan(homeownerSlug, propertySlug)) ?? null;

  if (!planData) {
    return <MemberPortalNotFound />;
  }

  const propertyId = await getPropertyIdBySlugs(homeownerSlug, propertySlug);
  const portalPath = `/homecare/${homeownerSlug}/${propertySlug}/portal`;

  let latest = null;
  let notes: ReturnType<typeof extractVisibleCustomerNotes> = [];

  if (propertyId) {
    const [latestResult, assessments, checks] = await Promise.all([
      getLatestCustomerHealthUnified(propertyId),
      listStaffAssessments(propertyId),
      listStaffHealthChecks(propertyId),
    ]);
    latest = latestResult;
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
        propertyLabel={planData.property.name}
        backHref={portalPath}
      />
    </div>
  );
}
