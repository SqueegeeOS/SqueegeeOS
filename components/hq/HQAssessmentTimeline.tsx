import {
  getAreaDefinition,
  type AssessmentAreaKey,
} from "@/lib/health/assessment-areas";
import { assessmentTypeLabel } from "@/lib/health/assessment-types";
import { SCORE_COLORS } from "@/lib/health/assessment-types";
import type { PropertyAssessment } from "@/lib/health/assessment-types";
import {
  HEALTH_SCORE_COLORS,
  HEALTH_SCORE_LABELS,
  parseHealthScore,
  type PropertyHealthCheck,
} from "@/lib/health/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreChip({ label, score }: { label: string; score: number | null }) {
  const s = parseHealthScore(score);
  const color = s ? HEALTH_SCORE_COLORS[s] : "#222";

  return (
    <div className="rounded-lg bg-[#0d0d0d] px-2 py-2.5 text-center">
      <p className="mb-1 text-[10px] text-[#333]">{label}</p>
      {s !== null ? (
        <>
          <p className="font-serif text-base" style={{ color }}>
            {s}
          </p>
          <p className="mt-0.5 text-[9px]" style={{ color }}>
            {HEALTH_SCORE_LABELS[s]}
          </p>
        </>
      ) : (
        <p className="text-sm text-[#222]">—</p>
      )}
    </div>
  );
}

function AssessmentCard({ assessment }: { assessment: PropertyAssessment }) {
  const isVisitNote = assessment.assessmentType === "visit_note";

  return (
    <div className="craft-glass-subtle rounded-[var(--radius-card)] px-6 py-5 shadow-[var(--shadow-ambient)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {formatDate(assessment.visitDate)}
          </p>
          <p className="mt-0.5 text-xs text-[#444]">
            {assessment.technicianName} ·{" "}
            {assessmentTypeLabel(assessment.assessmentType)}
          </p>
        </div>
        {!isVisitNote && assessment.overallScore !== null && (
          <div className="text-right">
            <p className="font-serif text-2xl text-[#c9a96e]">
              {assessment.overallScore}%
            </p>
            <p className="text-[10px] text-[#444]">overall</p>
          </div>
        )}
      </div>

      {!isVisitNote ? (
        <div className="mb-5 grid grid-cols-3 gap-2">
          {assessment.assessedAreas.map((key) => {
            const def = getAreaDefinition(key as AssessmentAreaKey);
            const isNA = assessment.naAreas.includes(key as AssessmentAreaKey);
            const score = assessment.scores[key];
            return (
              <div
                key={key}
                className="rounded-lg bg-[#0d0d0d] px-2 py-2.5 text-center"
              >
                <p className="mb-1 text-[10px] text-[#333]">
                  {def?.label ?? key}
                </p>
                {isNA ? (
                  <p className="text-xs text-[#444]">N/A</p>
                ) : score != null ? (
                  <p
                    className="font-serif text-base"
                    style={{ color: SCORE_COLORS[score] }}
                  >
                    {score}
                  </p>
                ) : (
                  <p className="text-sm text-[#222]">—</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {assessment.proposalSummary && (
        <div className="mb-2 rounded-lg border border-[#c9a96e18] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#c9a96e]">
            {isVisitNote ? "Follow-up" : "Proposal Summary"}
          </p>
          <p className="text-xs leading-relaxed text-[#777]">
            {assessment.proposalSummary}
          </p>
        </div>
      )}

      {assessment.internalNote && (
        <div className="mb-2 rounded-lg border border-[#1e1e1e] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
            Internal Note
          </p>
          <p className="text-xs leading-relaxed text-[#777]">
            {assessment.internalNote}
          </p>
        </div>
      )}

      {assessment.customerNote && (
        <div className="rounded-lg border border-[#c9a96e18] px-3 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest text-[#c9a96e]">
              Customer Note
            </p>
            <span className="text-[10px] text-[#333]">
              {assessment.customerNoteVisible
                ? "· visible in portal"
                : "· hidden from customer"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#777]">
            {assessment.customerNote}
          </p>
        </div>
      )}
    </div>
  );
}

function LegacyCheckCard({ check }: { check: PropertyHealthCheck }) {
  const grid: Array<[string, number | null]> = [
    ["Windows", check.scores.windowHealth],
    ["Screens", check.scores.screenHealth],
    ["Track/Sill", check.scores.trackSillHealth],
    ["Frames", check.scores.frameHealth],
    ["Hard Water", check.scores.hardWaterRisk],
    ["Debris", check.scores.debrisBuildup],
  ];

  return (
    <div className="craft-glass-subtle rounded-[var(--radius-card)] px-6 py-5 opacity-90 shadow-[var(--shadow-ambient)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {formatDate(check.visitDate)}
          </p>
          <p className="mt-0.5 text-xs text-[#444]">
            {check.technicianName} · Legacy window check
          </p>
        </div>
        {check.overallScore !== null && (
          <p className="font-serif text-2xl text-[#c9a96e]">
            {check.overallScore}%
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {grid.map(([label, score]) => (
          <ScoreChip key={label} label={label} score={score} />
        ))}
      </div>
    </div>
  );
}

export function HQAssessmentTimeline({
  assessments,
  legacyChecks,
}: {
  assessments: PropertyAssessment[];
  legacyChecks: PropertyHealthCheck[];
}) {
  type TimelineItem =
    | { kind: "assessment"; date: string; data: PropertyAssessment }
    | { kind: "legacy"; date: string; data: PropertyHealthCheck };

  const items: TimelineItem[] = [
    ...assessments.map((a) => ({
      kind: "assessment" as const,
      date: a.visitDate,
      data: a,
    })),
    ...legacyChecks.map((c) => ({
      kind: "legacy" as const,
      date: c.visitDate,
      data: c,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.kind === "assessment" ? (
          <AssessmentCard key={item.data.id} assessment={item.data} />
        ) : (
          <LegacyCheckCard key={item.data.id} check={item.data} />
        ),
      )}
    </div>
  );
}
