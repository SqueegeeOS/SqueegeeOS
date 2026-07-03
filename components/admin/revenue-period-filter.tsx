"use client";

import type { RevenuePeriodFilter } from "@/lib/admin/closed-jobs-types";
import { REVENUE_PERIOD_FILTERS } from "@/lib/admin/closed-jobs-types";

interface RevenuePeriodFilterProps {
  value: RevenuePeriodFilter;
  onChange: (value: RevenuePeriodFilter) => void;
}

export function RevenuePeriodFilterBar({
  value,
  onChange,
}: RevenuePeriodFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {REVENUE_PERIOD_FILTERS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-all duration-300 touch-manipulation ${
              active
                ? "border-accent/40 bg-accent/[0.1] text-accent shadow-[0_0_24px_rgba(201,184,150,0.12)]"
                : "border-border/80 bg-background/40 text-muted hover:border-accent/20 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
