"use client";

import {
  HEALTH_SCORE_COLORS,
  HEALTH_SCORE_LABELS,
  type HealthScore,
} from "@/lib/health/types";

interface ScoreRowProps {
  label: string;
  value: HealthScore | null;
  onChange: (value: HealthScore) => void;
}

const SCORES: HealthScore[] = [1, 2, 3, 4, 5];

export function ScoreRow({ label, value, onChange }: ScoreRowProps) {
  return (
    <div className="rounded-xl bg-[#111] px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#bbb]">{label}</span>
        {value !== null && (
          <span
            className="text-xs font-medium transition-colors"
            style={{ color: HEALTH_SCORE_COLORS[value] }}
          >
            {HEALTH_SCORE_LABELS[value]}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {SCORES.map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className="h-12 flex-1 select-none rounded-lg text-sm font-semibold transition-all duration-100 active:scale-95"
              style={{
                backgroundColor: selected
                  ? HEALTH_SCORE_COLORS[score]
                  : "#1a1a1a",
                color: selected ? "#000" : "#555",
                border: selected
                  ? `1px solid ${HEALTH_SCORE_COLORS[score]}`
                  : "1px solid #222",
              }}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}
