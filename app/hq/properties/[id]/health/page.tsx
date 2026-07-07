import type { Metadata } from "next";
import Link from "next/link";
import { HQAssessmentTimeline } from "@/components/hq/HQAssessmentTimeline";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";
import {
  listStaffAssessments,
} from "@/lib/health/assessment-repository";
import {
  getPropertyHealthHeader,
  listStaffHealthChecks,
} from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Property Health | HQ",
  robots: { index: false, follow: false },
};

interface PropertyHealthPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyHealthPage({
  params,
}: PropertyHealthPageProps) {
  const { id } = await params;
  const [property, assessments, legacyChecks] = await Promise.all([
    getPropertyHealthHeader(id),
    listStaffAssessments(id),
    listStaffHealthChecks(id),
  ]);

  const hasRecords = assessments.length > 0 || legacyChecks.length > 0;

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[#0a0a0a] px-4 py-10 text-white">
      <div className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
          HQ · Property Memory
        </p>
        <h1 className="font-serif text-2xl text-white">
          {property?.address ?? "Property"}
        </h1>
        {property?.customerName && (
          <p className="mt-0.5 text-sm text-[#444]">
            <CustomerWorkspaceLink
              type="property"
              id={id}
              className="text-[#888] hover:text-[#c9a96e]"
            >
              {property.customerName}
            </CustomerWorkspaceLink>
          </p>
        )}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/hq/customers/property/${id}`}
          className="inline-block rounded-lg border border-[#333] px-4 py-2 text-xs text-[#888] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e]"
        >
          Customer workspace
        </Link>
        <Link
          href={`/tech/properties/${id}/assessment`}
          className="inline-block rounded-lg border border-[#333] px-4 py-2 text-xs text-[#888] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e]"
        >
          + Record Assessment
        </Link>
      </div>

      {hasRecords ? (
        <HQAssessmentTimeline
          assessments={assessments}
          legacyChecks={legacyChecks}
        />
      ) : (
        <div className="rounded-2xl bg-[#111] px-6 py-12 text-center">
          <p className="text-sm text-[#333]">
            No assessments recorded yet for this property.
          </p>
        </div>
      )}
    </div>
  );
}
