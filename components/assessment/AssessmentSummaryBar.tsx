"use client";

import { scoreColor } from "@/lib/health/assessment-types";

interface AssessmentSummaryBarProps {
  score: number | null;
  scoredCount: number;
  totalCount: number;
}

export function AssessmentSummaryBar({
  score,
  scoredCount,
  totalCount,
}: AssessmentSummaryBarProps) {
  if (score === null && scoredCount === 0) return null;

  const color = scoreColor(score);

  return (
    <div className="mb-4 rounded-xl bg-[#111] px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
            Overall Care Score
          </p>
          <p
            className="font-serif text-3xl transition-all duration-300"
            style={{ color: score != null ? color : "#444" }}
          >
            {score != null ? `${score}%` : "—"}
          </p>
        </div>
        <p className="text-xs text-[#444]">
          {scoredCount} of {totalCount} scored
        </p>
      </div>
      {score != null && (
        <div className="mt-3 h-[2px] overflow-hidden rounded-full bg-[#1a1a1a]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}
