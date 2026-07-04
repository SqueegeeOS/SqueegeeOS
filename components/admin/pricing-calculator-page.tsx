"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { ROUTES } from "@/lib/navigation/config";
import {
  calculateQuarterlyBaseQuote,
  formatPricingAmount,
  PRICING_PRESET_SQFT,
  QUARTERLY_BASE_RATE_PER_SQFT,
} from "@/lib/pricing/quarterly-base-calculator";

function PriceRow({
  label,
  perVisit,
  annual,
  highlight = false,
}: {
  label: string;
  perVisit: number;
  annual?: number;
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
      {annual != null && (
        <p className="mt-1 text-xs text-muted">
          {formatPricingAmount(annual)} / year · 4 visits
        </p>
      )}
    </div>
  );
}

export function PricingCalculatorPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const [sqft, setSqft] = useState(2500);

  const quote = useMemo(() => calculateQuarterlyBaseQuote(sqft), [sqft]);

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
            Quarterly pricing calculator
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Exterior-only floor pricing at{" "}
            {formatPricingAmount(QUARTERLY_BASE_RATE_PER_SQFT * 1000)} per 1,000
            sq ft per visit. Screens are never included. Interior adds 60%. One-time
            jobs add {formatPricingAmount(quote.oneTimePremium)} vs the member rate.
          </p>
        </header>

        <section className="mt-10 rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 sm:p-8">
          <label
            htmlFor="sqft-input"
            className="text-[10px] uppercase tracking-[0.28em] text-muted"
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
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              Quarterly membership
            </p>
            <p className="mt-2 text-sm text-muted">
              Cheapest plan — exterior only unless inside + out is selected. No
              screen cleaning on any tier.
            </p>
            <div className="mt-4 space-y-3">
              <PriceRow
                label="Exterior only"
                perVisit={quote.quarterlyExterior}
                annual={quote.quarterlyExteriorAnnual}
                highlight
              />
              <PriceRow
                label="Inside + outside"
                perVisit={quote.quarterlyInsideOut}
                annual={quote.quarterlyInsideOutAnnual}
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
              <PriceRow
                label="Exterior only"
                perVisit={quote.oneTimeExterior}
              />
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
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>
              1,400 sq ft → {formatPricingAmount(140)}/visit quarterly exterior ·{" "}
              {formatPricingAmount(290)} one-time exterior
            </li>
            <li>
              1,500 sq ft → {formatPricingAmount(150)}/visit quarterly exterior ·{" "}
              {formatPricingAmount(240)}/visit inside + out ·{" "}
              {formatPricingAmount(300)} one-time exterior ·{" "}
              {formatPricingAmount(480)} one-time inside + out
            </li>
            <li>
              2,500 sq ft → {formatPricingAmount(250)}/visit quarterly exterior ·{" "}
              {formatPricingAmount(400)} one-time exterior
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
