import { GeneratedHomeCarePlanClient } from "./generated-home-care-plan-client";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";

export const dynamic = "force-dynamic";

export default async function GeneratedHomeCarePlanPage({
  params,
}: {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
  }>;
}) {
  const { homeownerSlug, propertySlug } = await params;
  const cloudPersistenceConnected = isCloudPersistenceConnected();

  return (
    <GeneratedHomeCarePlanClient
      key={`${homeownerSlug}:${propertySlug}`}
      homeownerSlug={homeownerSlug}
      propertySlug={propertySlug}
      initialPlan={null}
      cloudPersistenceConnected={cloudPersistenceConnected}
      allowLocalFallback={!cloudPersistenceConnected}
    />
  );
}
