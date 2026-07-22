import type { Metadata } from "next";
import { GeneratedHomeCarePlanClient } from "../generated-home-care-plan-client";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { loadHomeCarePlanPresentationByCapability } from "@/lib/persistence/server/load-home-care-plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CapabilityHomeCarePlanPage({
  params,
}: {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
    planId: string;
  }>;
}) {
  const { homeownerSlug, propertySlug, planId } = await params;
  const cloudPersistenceConnected = isCloudPersistenceConnected();
  const initialPlan = cloudPersistenceConnected
    ? await loadHomeCarePlanPresentationByCapability(
        planId,
        homeownerSlug,
        propertySlug,
      )
    : null;

  return (
    <GeneratedHomeCarePlanClient
      key={`${planId}:${homeownerSlug}:${propertySlug}`}
      homeownerSlug={homeownerSlug}
      propertySlug={propertySlug}
      initialPlan={initialPlan}
      cloudPersistenceConnected={cloudPersistenceConnected}
      allowLocalFallback={false}
    />
  );
}
