"use client";

import type { AssessmentType } from "@/lib/health/assessment-types";

interface AssessmentModeSelectorProps {
  onSelect: (mode: AssessmentType) => void;
}

const MODES = [
  {
    type: "window_service" as AssessmentType,
    icon: "🪟",
    label: "Window Health Check",
    time: "~2 min",
    description:
      "Score window, screen, track, frame, hard water, and debris.",
    featured: false,
  },
  {
    type: "care_package" as AssessmentType,
    icon: "✦",
    label: "Custom Care Assessment",
    time: "~20 min",
    description:
      "Full property assessment. Add any area. NA for non-applicable. Generates a care proposal.",
    featured: true,
  },
  {
    type: "custom" as AssessmentType,
    icon: "⊕",
    label: "Custom Assessment",
    time: "Flexible",
    description: "Start with windows, add any areas you need.",
    featured: false,
  },
];

export function AssessmentModeSelector({
  onSelect,
}: AssessmentModeSelectorProps) {
  return (
    <div className="pb-8">
      <div className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
          Atlas · Property Assessment
        </p>
        <h1 className="font-serif text-2xl text-white">What are you here for?</h1>
        <p className="mt-1 text-sm text-[#444]">
          Choose the type of assessment for this visit.
        </p>
      </div>

      <div className="space-y-3">
        {MODES.map((mode) => (
          <button
            key={mode.type}
            type="button"
            onClick={() => onSelect(mode.type)}
            className="w-full rounded-2xl px-5 py-5 text-left transition-all active:scale-[0.98]"
            style={{
              backgroundColor: mode.featured ? "#141008" : "#111",
              border: mode.featured
                ? "1px solid #c9a96e22"
                : "1px solid #1a1a1a",
            }}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{mode.icon}</span>
                <span
                  className="text-base font-medium"
                  style={{ color: mode.featured ? "#c9a96e" : "#ccc" }}
                >
                  {mode.label}
                </span>
              </div>
              <span className="mt-0.5 text-[10px] text-[#444]">{mode.time}</span>
            </div>
            <p className="ml-7 text-xs leading-relaxed text-[#444]">
              {mode.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
