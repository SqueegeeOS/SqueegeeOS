"use client";

import type { AssessmentAreaDefinition } from "@/lib/health/assessment-areas";
import { SCORE_COLORS, type ScoreValue } from "@/lib/health/assessment-types";

interface AssessmentAreaCardProps {
  definition: AssessmentAreaDefinition;
  score: ScoreValue;
  isNA: boolean;
  allowNA: boolean;
  removable: boolean;
  onScore: (value: ScoreValue) => void;
  onToggleNA: () => void;
  onRemove: () => void;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function AssessmentAreaCard({
  definition,
  score,
  isNA,
  allowNA,
  removable,
  onScore,
  onToggleNA,
  onRemove,
}: AssessmentAreaCardProps) {
  return (
    <div
      className="rounded-xl px-4 py-3 transition-opacity"
      style={{ backgroundColor: "#111", opacity: isNA ? 0.5 : 1 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">{definition.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight text-[#ccc]">
              {definition.label}
            </p>
            <p className="text-[10px] leading-tight text-[#333]">
              {definition.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {score !== null && !isNA && (
            <span
              className="text-[10px] font-medium"
              style={{ color: SCORE_COLORS[score] }}
            >
              {definition.scoreLabels[score]}
            </span>
          )}
          {isNA && <span className="text-[10px] text-[#444]">N/A</span>}
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-1 text-xs text-[#2a2a2a] transition-colors hover:text-[#666]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5">
        {SCORES.map((s) => {
          const selected = score === s && !isNA;
          return (
            <button
              key={s}
              type="button"
              disabled={isNA}
              onClick={() => onScore(s)}
              className="h-11 flex-1 select-none rounded-lg text-sm font-semibold transition-all duration-100 active:scale-95 disabled:cursor-not-allowed"
              style={{
                backgroundColor: selected ? SCORE_COLORS[s] : "#1a1a1a",
                color: selected ? "#000" : "#444",
                border: selected
                  ? `1px solid ${SCORE_COLORS[s]}`
                  : "1px solid #1e1e1e",
              }}
            >
              {s}
            </button>
          );
        })}

        {allowNA && (
          <button
            type="button"
            onClick={onToggleNA}
            className="h-11 select-none rounded-lg px-3 text-xs font-semibold transition-all duration-100 active:scale-95"
            style={{
              backgroundColor: isNA ? "#2a2a2a" : "#141414",
              color: isNA ? "#888" : "#333",
              border: isNA ? "1px solid #444" : "1px solid #1e1e1e",
            }}
          >
            NA
          </button>
        )}
      </div>
    </div>
  );
}
