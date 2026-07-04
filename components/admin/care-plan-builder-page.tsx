"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FadePriceBlock, RollingPrice } from "@/components/admin/pricing-motion";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { buildCopyQuote, formatDollars } from "@/lib/pricing/format";
import type { CareFrequency } from "@/lib/pricing/types";
import {
  calculateWindowCarePricing,
  getPricingComparison,
  MAX_SQFT,
  MIN_SQFT,
  PRICING_SQFT_PRESETS,
  validateInput,
} from "@/lib/pricing/window-care-pricing";
import { ROUTES } from "@/lib/navigation/config";

/** Future: gate ranges, lead capture, hide one-time comparison. */
const CUSTOMER_FACING_MODE = false;

const pillBase =
  "rounded-full border px-5 py-2.5 text-xs uppercase tracking-[0.14em] transition-all duration-200";
const pillSelected =
  "border-accent/50 bg-accent/10 text-accent shadow-[0_0_24px_rgba(197,168,105,0.12)]";
const pillIdle =
  "border-border text-muted hover:border-accent/25";

export function CarePlanBuilderPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const [frequency, setFrequency] = useState<CareFrequency>("quarterly");
  const [sqft, setSqft] = useState(2500);
  const [includeInterior, setIncludeInterior] = useState(false);
  const [copied, setCopied] = useState(false);

  const clampedSqft = Math.min(MAX_SQFT, Math.max(MIN_SQFT, sqft || MIN_SQFT));

  const validationError = useMemo(
    () =>
      validateInput({
        squareFeet: sqft,
        frequency,
        includeInterior,
      }),
    [sqft, frequency, includeInterior],
  );

  const pricing = useMemo(() => {
    if (validationError) return null;
    return calculateWindowCarePricing({
      squareFeet: clampedSqft,
      frequency,
      includeInterior,
    });
  }, [clampedSqft, frequency, includeInterior, validationError]);

  const comparison = useMemo(() => {
    if (validationError) return null;
    return getPricingComparison({
      squareFeet: clampedSqft,
      frequency,
      includeInterior,
    });
  }, [clampedSqft, frequency, includeInterior, validationError]);

  const recurringPrice = includeInterior
    ? pricing?.interiorExteriorMemberPrice ?? 0
    : pricing?.exteriorMemberPrice ?? 0;

  const oneTimePrice = includeInterior
    ? pricing?.interiorExteriorOneTimePrice ?? 0
    : pricing?.exteriorOneTimePrice ?? 0;

  const annualValue = includeInterior
    ? pricing?.annualInteriorExteriorValue ?? 0
    : pricing?.annualExteriorValue ?? 0;

  const priceKey = `${frequency}-${clampedSqft}-${includeInterior}`;

  const handleSqftChange = (raw: number) => {
    if (raw < 0) {
      setSqft(MIN_SQFT);
      return;
    }
    setSqft(raw);
  };

  const handleCopyQuote = async () => {
    if (!pricing || CUSTOMER_FACING_MODE) return;
    const text = buildCopyQuote(clampedSqft, pricing);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

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
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
            Standard Pricing Engine
          </p>
          <h1 className="mt-3 font-serif text-4xl font-light text-foreground sm:text-5xl">
            Home Care Plan Builder
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Precision quoting for exterior glass and interior + exterior glass.
            Recurring care reduces each one-time visit by{" "}
            {formatDollars(pricing?.oneTimePremium ?? 150)}.
          </p>
        </header>

        <section className="mt-10 space-y-8 rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 sm:p-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              Care Frequency
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFrequency("quarterly")}
                className={`${pillBase} ${frequency === "quarterly" ? pillSelected : pillIdle}`}
              >
                Every 3 Months
              </button>
              <button
                type="button"
                onClick={() => setFrequency("bi_annual")}
                className={`${pillBase} ${frequency === "bi_annual" ? pillSelected : pillIdle}`}
              >
                Every 6 Months
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="sqft-input"
              className="text-[10px] uppercase tracking-[0.28em] text-muted"
            >
              Property Size
            </label>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <input
                id="sqft-input"
                type="number"
                min={MIN_SQFT}
                max={MAX_SQFT}
                step={100}
                value={sqft}
                onChange={(event) =>
                  handleSqftChange(Number(event.target.value) || 0)
                }
                className="w-full max-w-xs rounded-xl border border-border bg-background px-4 py-3 text-2xl font-serif font-light text-foreground outline-none focus:border-accent/40"
              />
              <span className="pb-3 text-sm text-muted">sq ft</span>
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-400/90">{validationError}</p>
            )}
            <input
              type="range"
              min={MIN_SQFT}
              max={MAX_SQFT}
              step={100}
              value={clampedSqft}
              onChange={(event) => setSqft(Number(event.target.value))}
              className="mt-6 w-full accent-accent"
              aria-label="Adjust square footage"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {PRICING_SQFT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSqft(preset)}
                  className={`${pillBase} text-[11px] ${
                    sqft === preset ? pillSelected : pillIdle
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              Service Scope
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIncludeInterior(false)}
                className={`${pillBase} ${!includeInterior ? pillSelected : pillIdle}`}
              >
                Exterior Glass
              </button>
              <button
                type="button"
                onClick={() => setIncludeInterior(true)}
                className={`${pillBase} ${includeInterior ? pillSelected : pillIdle}`}
              >
                Interior + Exterior Glass
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Base pricing includes glass only. Screens are not included.
            </p>
          </div>
        </section>

        {pricing && comparison && (
          <>
            <FadePriceBlock priceKey={priceKey}>
              <div className="mt-10 grid gap-6 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-accent/25 bg-accent/[0.05] p-6 sm:p-8">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                    Recurring Care
                  </p>
                  <p className="mt-4 font-serif text-5xl font-light text-accent">
                    <RollingPrice value={recurringPrice} />
                  </p>
                  <p className="mt-1 text-sm text-muted">per visit</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted">
                    {pricing.frequencyLabel}
                  </p>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-muted">
                    Annual{" "}
                    {includeInterior ? "interior + exterior" : "exterior"} value:{" "}
                    <span className="text-foreground/80">
                      {formatDollars(annualValue)}
                    </span>
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-border/70 bg-surface/30 p-6 sm:p-8">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
                    One-Time Visit
                  </p>
                  <p className="mt-4 font-serif text-5xl font-light text-foreground/90">
                    <RollingPrice value={oneTimePrice} />
                  </p>
                  <p className="mt-1 text-sm text-muted">per visit</p>
                  <p className="mt-3 text-xs text-muted">No recurring plan</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    Recurring care reduces this visit by{" "}
                    {formatDollars(pricing.oneTimePremium)}.
                  </p>
                </div>
              </div>
            </FadePriceBlock>

            <section className="mt-10 rounded-[1.75rem] border border-border/70 bg-surface/30 p-6 sm:p-8">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
                Comparison
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Recurring Care</dt>
                  <dd>
                    <RollingPrice value={recurringPrice} className="text-foreground" />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">One-Time Visit</dt>
                  <dd>
                    <RollingPrice value={oneTimePrice} className="text-foreground" />
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border/60 pt-3">
                  <dt className="text-muted">Difference</dt>
                  <dd className="text-accent">
                    {formatDollars(pricing.oneTimePremium)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-muted">
                Recurring care reduces this visit by{" "}
                {formatDollars(pricing.oneTimePremium)}.
              </p>
            </section>

            <section className="mt-6 rounded-[1.75rem] border border-accent/20 border-l-4 bg-surface/20 px-6 py-5 sm:px-8">
              <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                Atlas Recommendation
              </p>
              <p className="mt-3 text-sm italic leading-relaxed text-muted">
                {frequency === "quarterly"
                  ? "For this property, Every 3 Months care creates the lowest cost per visit and keeps the home easier to maintain. Consistent care means less buildup, cleaner glass, and a property that's always ready."
                  : "Every 6 Months is a reliable foundation. For properties that want maximum protection and the lowest per-visit rate, Every 3 Months may be worth considering."}
              </p>
            </section>

            <section className="mt-8">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
                What&apos;s Not Included
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted/80">
                {pricing.exclusions.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </section>

            {!CUSTOMER_FACING_MODE && (
              <button
                type="button"
                onClick={() => void handleCopyQuote()}
                className="mt-8 w-full rounded-2xl border border-accent/30 bg-accent/10 px-6 py-4 text-sm font-medium tracking-[0.06em] text-accent transition-colors hover:border-accent/50"
              >
                {copied ? "Copied ✓" : "Copy Quote Summary"}
              </button>
            )}

            <p className="mt-4 text-xs text-muted/70">
              <Link href={ROUTES.hqPricingSettings} className="hover:text-accent">
                ⚙ Pricing settings
              </Link>{" "}
              · Atlas Pricing Engine v1.0
            </p>
          </>
        )}
      </div>
    </div>
  );
}
