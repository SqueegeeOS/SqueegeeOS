"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { ROUTES } from "@/lib/navigation/config";
import {
  calculateMembershipPricingQuote,
  formatPricingAmount,
  PRICING_CADENCE_CONFIG,
  PRICING_PRESET_SQFT,
  ratePerThousandSqft,
  type PricingCadence,
} from "@/lib/pricing/membership-pricing-calculator";

function PriceRow({
  label,
  perVisit,
  annual,
  visitsPerYear,
  highlight = false,
}: {
  label: string;
  perVisit: number;
  annual?: number;
  visitsPerYear?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        highlight
          ? "border-accent/30 bg-accent/[0.06]"
          : "border-border/70 bg-background/30"
      }`}
    >
      <p className="text-sm text-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-light text-foreground">
        {formatPricingAmount(perVisit)}
        <span className="text-base text-muted"> / visit</span>
      </p>
      {annual != null && visitsPerYear != null && (
        <p className="mt-1 text-xs text-muted">
          {formatPricingAmount(annual)} / year · {visitsPerYear} visits
        </p>
      )}
    </div>
  );
}

export function PricingCalculatorPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const [cadence, setCadence] = useState<PricingCadence>("quarterly");
  const [sqft, setSqft] = useState(2500);

  const config = PRICING_CADENCE_CONFIG[cadence];
  const quote = useMemo(
    () => calculateMembershipPricingQuote(sqft, cadence),
    [sqft, cadence],
  );

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-[100svh] bg-background pb-24">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={ROUTES.hq}
          className="text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-accent"
        >
          ← Headquarters
        </Link>

        <header className="mt-8 border-b border-border/70 pb-10">
          <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
            Base Rate Sheet
          </p>
          <h1 className="mt-3 font-serif text-4xl font-light text-foreground sm:text-5xl">
            Membership pricing calculator
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Exterior-only floor pricing — screens never included. Interior adds
            60%. One-time jobs add {formatPricingAmount(quote.oneTimePremium)} vs
            the member rate.
          </p>
        </header>

        <section className="mt-10 rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Membership cadence
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(PRICING_CADENCE_CONFIG) as PricingCadence[]).map(
              (option) => {
                const def = PRICING_CADENCE_CONFIG[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCadence(option)}
                    className={`rounded-full border px-5 py-2.5 text-left transition-colors ${
                      cadence === option
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border text-muted hover:border-accent/25"
                    }`}
                  >
                    <span className="block text-xs uppercase tracking-[0.14em]">
                      {def.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-muted">
                      {formatPricingAmount(ratePerThousandSqft(def.ratePerSqft))}{" "}
                      / 1,000 sq ft · {def.visitsPerYear} visits/yr
                    </span>
                  </button>
                );
              },
            )}
          </div>

          <label
            htmlFor="sqft-input"
            className="mt-8 block text-[10px] uppercase tracking-[0.28em] text-muted"
          >
            Home square footage
          </label>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <input
              id="sqft-input"
              type="number"
              min={0}
              step={100}
              value={sqft}
              onChange={(event) => setSqft(Number(event.target.value) || 0)}
              className="w-full max-w-xs rounded-xl border border-border bg-background px-4 py-3 text-2xl font-serif font-light text-foreground outline-none focus:border-accent/40"
            />
            <span className="pb-3 text-sm text-muted">sq ft</span>
          </div>

          <input
            type="range"
            min={800}
            max={6000}
            step={100}
            value={Math.min(6000, Math.max(800, sqft))}
            onChange={(event) => setSqft(Number(event.target.value))}
            className="mt-6 w-full accent-accent"
            aria-label="Adjust square footage"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {PRICING_PRESET_SQFT.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSqft(preset)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.14em] transition-colors ${
                  sqft === preset
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-accent/25"
                }`}
              >
                {preset.toLocaleString()} sq ft
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted">
            Selected: <span className="text-foreground">{config.label}</span> ·{" "}
            {config.tagline} · {config.frequency} ·{" "}
            {formatPricingAmount(ratePerThousandSqft(config.ratePerSqft))} per
            1,000 sq ft
          </p>
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              {config.label} membership
            </p>
            <p className="mt-2 text-sm text-muted">
              Exterior only unless inside + out is selected. No screen cleaning.
            </p>
            <div className="mt-4 space-y-3">
              <PriceRow
                label="Exterior only"
                perVisit={quote.memberExterior}
                annual={quote.memberExteriorAnnual}
                visitsPerYear={quote.visitsPerYear}
                highlight
              />
              <PriceRow
                label="Inside + outside"
                perVisit={quote.memberInsideOut}
                annual={quote.memberInsideOutAnnual}
                visitsPerYear={quote.visitsPerYear}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              One-time (no membership)
            </p>
            <p className="mt-2 text-sm text-muted">
              Member rate + {formatPricingAmount(quote.oneTimePremium)} per visit.
              Interior still adds 60% to the exterior price.
            </p>
            <div className="mt-4 space-y-3">
              <PriceRow label="Exterior only" perVisit={quote.oneTimeExterior} />
              <PriceRow
                label="Inside + outside"
                perVisit={quote.oneTimeInsideOut}
              />
            </div>
          </div>
        </div>

        <section className="mt-10 rounded-[1.75rem] border border-border/70 bg-surface/30 p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Reference examples
          </p>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>
              <span className="text-foreground/80">Quarterly</span> · 1,000 sq ft
              → {formatPricingAmount(100)}/visit exterior ·{" "}
              {formatPricingAmount(250)} one-time exterior
            </li>
            <li>
              <span className="text-foreground/80">Bi-Annual</span> · 1,000 sq ft
              → {formatPricingAmount(125)}/visit exterior ·{" "}
              {formatPricingAmount(275)} one-time exterior
            </li>
            <li>
              <span className="text-foreground/80">Quarterly</span> · 1,500 sq ft
              → {formatPricingAmount(150)}/visit exterior ·{" "}
              {formatPricingAmount(240)}/visit inside + out ·{" "}
              {formatPricingAmount(300)} one-time exterior ·{" "}
              {formatPricingAmount(480)} one-time inside + out
            </li>
            <li>
              <span className="text-foreground/80">Quarterly</span> · 2,500 sq ft
              → {formatPricingAmount(250)}/visit exterior ·{" "}
              {formatPricingAmount(400)} one-time exterior
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
