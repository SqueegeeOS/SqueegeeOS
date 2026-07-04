import type { Metadata } from "next";
import Link from "next/link";
import { getAssessmentById } from "@/lib/health/assessment-repository";
import { getPropertyHealthHeader } from "@/lib/health/repository";
import { assessmentTypeLabel } from "@/lib/health/assessment-types";
import { getAreaDefinition } from "@/lib/health/assessment-areas";
import { SCORE_COLORS } from "@/lib/health/assessment-types";

export const metadata: Metadata = {
  title: "Proposal Preview | Technician",
  robots: { index: false, follow: false },
};

interface ProposalPreviewPageProps {
  searchParams: Promise<{ propertyId?: string; assessmentId?: string }>;
}

export default async function ProposalPreviewPage({
  searchParams,
}: ProposalPreviewPageProps) {
  const { propertyId, assessmentId } = await searchParams;

  if (!propertyId || !assessmentId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-[#555]">
        Missing assessment context.
      </div>
    );
  }

  const [property, assessment] = await Promise.all([
    getPropertyHealthHeader(propertyId),
    getAssessmentById(assessmentId),
  ]);

  if (!assessment || assessment.propertyId !== propertyId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-[#555]">Assessment not found.</p>
        <Link
          href={`/tech/properties/${propertyId}`}
          className="mt-4 inline-block text-sm text-[#c9a96e]"
        >
          ← Back to property
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <Link
        href={`/tech/properties/${propertyId}`}
        className="mb-6 inline-block text-[10px] uppercase tracking-widest text-[#555] hover:text-[#c9a96e]"
      >
        ← Back to property
      </Link>

      <header className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#c9a96e]">
          Care Proposal Preview
        </p>
        <h1 className="font-serif text-2xl text-white">
          {property?.name ?? "Property"}
        </h1>
        <p className="mt-1 text-sm text-[#666]">
          {assessmentTypeLabel(assessment.assessmentType)} ·{" "}
          {assessment.visitDate}
        </p>
        {assessment.overallScore != null && (
          <p className="mt-3 font-serif text-4xl text-[#c9a96e]">
            {assessment.overallScore}%
          </p>
        )}
      </header>

      {assessment.proposalSummary && (
        <section className="mb-6 rounded-2xl border border-[#222] bg-[#111] px-5 py-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-[#444]">
            Proposal Summary
          </p>
          <p className="text-sm leading-relaxed text-[#999]">
            {assessment.proposalSummary}
          </p>
        </section>
      )}

      {assessment.recommendedServices.length > 0 && (
        <section className="mb-6 rounded-2xl border border-[#222] bg-[#111] px-5 py-5">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
            Recommended Services
          </p>
          <ul className="space-y-2">
            {assessment.recommendedServices.map((s) => (
              <li
                key={s.id}
                className="rounded-lg bg-[#0d0d0d] px-3 py-2.5 text-sm text-[#ccc]"
              >
                <span className="text-[10px] uppercase tracking-wide text-[#c9a96e]">
                  {s.priority}
                </span>
                <p className="mt-0.5">{s.service}</p>
                {s.note && (
                  <p className="mt-0.5 text-xs text-[#555]">{s.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 rounded-2xl border border-[#222] bg-[#111] px-5 py-5">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
          Scored Areas
        </p>
        <ul className="space-y-2">
          {assessment.assessedAreas.map((key) => {
            const def = getAreaDefinition(key);
            const score = assessment.scores[key];
            const isNA = assessment.naAreas.includes(key);
            return (
              <li
                key={key}
                className="flex items-center justify-between text-sm text-[#888]"
              >
                <span>
                  {def?.icon} {def?.label ?? key}
                </span>
                <span>
                  {isNA
                    ? "N/A"
                    : score != null
                      ? (
                          <span style={{ color: SCORE_COLORS[score] }}>
                            {score}/5
                          </span>
                        )
                      : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-center text-xs text-[#333]">
        Proposal delivery is coming soon. Assessment is saved to property memory.
      </p>
    </div>
  );
}
