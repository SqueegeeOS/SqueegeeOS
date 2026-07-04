import type { Metadata } from "next";
import { HomeHealthPanel } from "@/components/portal/HomeHealthPanel";
import {
  extractVisibleCustomerNotes,
  getLatestCustomerHealth,
  getPropertyHealthHeader,
  listStaffHealthChecks,
} from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Home Health",
  robots: { index: false, follow: false },
};

interface PortalHomeHealthPageProps {
  searchParams: Promise<{ propertyId?: string }>;
}

export default async function PortalHomeHealthPage({
  searchParams,
}: PortalHomeHealthPageProps) {
  const { propertyId } = await searchParams;

  if (!propertyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-muted">
          Open with <code className="text-foreground">?propertyId=...</code>
        </p>
      </div>
    );
  }

  const [property, latest, checks] = await Promise.all([
    getPropertyHealthHeader(propertyId),
    getLatestCustomerHealth(propertyId),
    listStaffHealthChecks(propertyId),
  ]);

  const notes = extractVisibleCustomerNotes(checks);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeHealthPanel
        latest={latest}
        notes={notes}
        propertyLabel={property?.name}
      />
    </div>
  );
}
