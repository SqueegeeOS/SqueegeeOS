import type { Metadata } from "next";
import { HomeHealthPanel } from "@/components/portal/HomeHealthPanel";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence/repository";
import {
  extractVisibleCustomerNotes,
  getLatestCustomerHealth,
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
    const [latestResult, checks] = await Promise.all([
      getLatestCustomerHealth(propertyId),
      listStaffHealthChecks(propertyId),
    ]);
    latest = latestResult;
    notes = extractVisibleCustomerNotes(checks);
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
