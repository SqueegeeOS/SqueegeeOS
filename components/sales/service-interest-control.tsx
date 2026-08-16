"use client";

import {
  normalizeSalesServiceInterests,
  SALES_SERVICE_INTEREST_OPTIONS,
  salesServiceInterestLabel,
  type SalesServiceInterest,
} from "@/lib/sales/service-interests";

export function ServiceInterestPicker({
  value,
  onChange,
  idPrefix,
  className = "",
}: {
  value: SalesServiceInterest[];
  onChange: (value: SalesServiceInterest[]) => void;
  idPrefix: string;
  className?: string;
}) {
  const selected = normalizeSalesServiceInterests(value);

  function toggle(interest: SalesServiceInterest) {
    if (interest === "exterior_windows") return;
    const next = selected.includes(interest)
      ? selected.filter((candidate) => candidate !== interest)
      : [...selected, interest];
    onChange(normalizeSalesServiceInterests(next));
  }

  return (
    <fieldset
      className={`rounded-2xl border border-white/[0.07] bg-black/10 p-4 ${className}`}
    >
      <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted">
        What are they interested in?
      </legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {SALES_SERVICE_INTEREST_OPTIONS.map((option) => {
          const active = selected.includes(option.id);
          const locked = option.id === "exterior_windows";
          return (
            <button
              key={option.id}
              id={`${idPrefix}-${option.id}`}
              type="button"
              aria-pressed={active}
              aria-describedby={`${idPrefix}-${option.id}-detail`}
              onClick={() => toggle(option.id)}
              className={`min-h-[4.5rem] rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                active
                  ? "border-accent/40 bg-accent/[0.09] text-foreground"
                  : "border-white/[0.08] bg-black/15 text-muted"
              } ${locked ? "cursor-default" : "hover:border-accent/25"}`}
            >
              <span className="flex items-center justify-between gap-3 text-xs font-semibold">
                {option.label}
                <span className="text-[9px] uppercase tracking-[0.12em] text-accent/75">
                  {locked ? "Core" : active ? "Interested" : "Add"}
                </span>
              </span>
              <span
                id={`${idPrefix}-${option.id}-detail`}
                className="mt-1 block text-[9px] leading-4 opacity-55"
              >
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-muted/65">
        This is conversation context only. It never adds a service, changes a
        price, sends a message, or charges the homeowner.
      </p>
    </fieldset>
  );
}

export function ServiceInterestChips({
  interests,
  className = "",
}: {
  interests: SalesServiceInterest[];
  className?: string;
}) {
  const normalized = normalizeSalesServiceInterests(interests);
  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      aria-label="Services discussed"
    >
      {normalized.map((interest) => (
        <span
          key={interest}
          className="rounded-full border border-white/[0.09] bg-white/[0.035] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-white/48"
        >
          {salesServiceInterestLabel(interest)}
        </span>
      ))}
    </div>
  );
}
