import type { Metadata } from "next";
import {
  extractVisibleCustomerNotesFromAssessments,
  getLatestCustomerHealthUnified,
  listStaffAssessments,
} from "@/lib/health/assessment-repository";
import {
  extractVisibleCustomerNotes,
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

  const [property, latest, assessments, legacyChecks] = await Promise.all([
    getPropertyHealthHeader(propertyId),
    getLatestCustomerHealthUnified(propertyId),
    listStaffAssessments(propertyId),
    listStaffHealthChecks(propertyId),
  ]);

  const notes = [
    ...extractVisibleCustomerNotesFromAssessments(assessments),
    ...extractVisibleCustomerNotes(legacyChecks),
  ].sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const { HomeHealthPanel } = await import(
    "@/components/portal/HomeHealthPanel"
  );

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
