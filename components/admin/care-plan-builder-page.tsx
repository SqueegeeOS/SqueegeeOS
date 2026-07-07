"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { FadePriceBlock, RollingPrice } from "@/components/admin/pricing-motion";
import { useCompanySettings } from "@/components/pricing/pricing-settings-provider";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { buildCopyQuote, formatDollars, memberSavingsQuoteLine } from "@/lib/pricing/format";
import { EXTERIOR_ADDON_AREA_GUIDANCE } from "@/lib/pricing/exterior-addon-guidance";
import {
  calculateExteriorAddOnQuote,
  defaultExteriorAddOnSelections,
  EXTERIOR_ADDON_LABELS,
  getMemberAddOnDiscountPercent,
} from "@/lib/pricing/exterior-addon-pricing";
import type { CareFrequency, ExteriorAddOnSelection } from "@/lib/pricing/types";
import {
  calculateWindowCarePricing,
  getMaxSqft,
  getMinSqft,
  getPricingComparison,
  PRICING_SQFT_PRESETS,
  validateInput,
} from "@/lib/pricing/window-care-pricing";
import { buildPresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
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
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const { settings } = useCompanySettings();
  const minSqft = getMinSqft(settings);
  const maxSqft = getMaxSqft(settings);
  const [frequency, setFrequency] = useState<CareFrequency>("quarterly");
  const [sqft, setSqft] = useState(2500);
  const [twoStory, setTwoStory] = useState(false);
  const [includeScreens, setIncludeScreens] = useState(false);
  const [includeInterior, setIncludeInterior] = useState(false);
  const [addOnSelections, setAddOnSelections] = useState<ExteriorAddOnSelection[]>(
    () => defaultExteriorAddOnSelections(),
  );
  const [copied, setCopied] = useState(false);
  const [creatingPresentation, setCreatingPresentation] = useState(false);

  const clampedSqft = Math.min(maxSqft, Math.max(minSqft, sqft || minSqft));

  const validationError = useMemo(
    () =>
      validateInput(
        {
          squareFeet: sqft,
          frequency,
          includeInterior,
          twoStory,
          includeScreens,
        },
        settings,
      ),
    [sqft, frequency, includeInterior, twoStory, includeScreens, settings],
  );

  const pricing = useMemo(() => {
    if (validationError) return null;
    return calculateWindowCarePricing(
      {
        squareFeet: clampedSqft,
        frequency,
        includeInterior,
        twoStory,
        includeScreens,
      },
      undefined,
      settings,
    );
  }, [clampedSqft, frequency, includeInterior, twoStory, includeScreens, validationError, settings]);

  const addOnQuote = useMemo(() => {
    if (validationError) return null;
    return calculateExteriorAddOnQuote(
      clampedSqft,
      addOnSelections,
      settings,
      { memberDiscountPercent: getMemberAddOnDiscountPercent(frequency, settings) },
    );
  }, [clampedSqft, addOnSelections, settings, validationError, frequency]);

  const comparison = useMemo(() => {
    if (validationError) return null;
    return getPricingComparison(
      {
        squareFeet: clampedSqft,
        frequency,
        includeInterior,
        twoStory,
        includeScreens,
      },
      undefined,
      settings,
    );
  }, [clampedSqft, frequency, includeInterior, twoStory, includeScreens, validationError, settings]);

  const recurringPrice = includeInterior
    ? pricing?.interiorExteriorMemberPrice ?? 0
    : pricing?.exteriorMemberPrice ?? 0;

  const oneTimePrice = includeInterior
    ? pricing?.interiorExteriorOneTimePrice ?? 0
    : pricing?.exteriorOneTimePrice ?? 0;

  const annualValue = includeInterior
    ? pricing?.annualInteriorExteriorValue ?? 0
    : pricing?.annualExteriorValue ?? 0;

  const priceKey = `${frequency}-${clampedSqft}-${includeInterior}-${twoStory}-${includeScreens}`;

  const handleSqftChange = (raw: number) => {
    if (raw < 0) {
      setSqft(minSqft);
      return;
    }
    setSqft(raw);
  };

  const totalEstimate =
    pricing && addOnQuote
      ? recurringPrice + (addOnQuote.subtotal ?? 0)
      : null;

  const memberSavingsLine =
    addOnQuote && addOnQuote.memberSavings > 0
      ? memberSavingsQuoteLine(frequency, addOnQuote.memberSavings)
      : null;

  const handleCopyQuote = async () => {
    if (!pricing || CUSTOMER_FACING_MODE) return;
    const text = buildCopyQuote(clampedSqft, pricing, addOnQuote, {
      frequency,
      windowCareVisitPrice: recurringPrice,
      exteriorBreakdown: pricing.exteriorBreakdown,
      oneTimeExteriorPrice: oneTimePrice,
      oneTimeBreakdown: pricing.oneTimeExteriorBreakdown,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCreatePresentation = async () => {
    if (!pricing || creatingPresentation) return;

    setCreatingPresentation(true);
    try {
      const quoteSnapshot = buildPresentationQuoteSnapshot({
        sqft: clampedSqft,
        frequency,
        includeInterior,
        twoStory,
        includeScreens,
        pricing,
        addOnQuote,
      });

      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: "Care Plan Builder",
          homeSqft: clampedSqft,
          tier: frequency === "quarterly" ? "quarterly" : "biannual",
          quoteSnapshot,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create");

      router.push(`/presentations/${data.presentation.id}/edit`);
    } catch {
      window.alert("Could not create presentation. Try again.");
      setCreatingPresentation(false);
    }
  };

  const updateAddOn = (
    id: ExteriorAddOnSelection["id"],
    patch: Partial<ExteriorAddOnSelection>,
  ) => {
    setAddOnSelections((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
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
                min={minSqft}
                max={maxSqft}
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
              min={minSqft}
              max={maxSqft}
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
              Base pricing is exterior glass. Screen cleaning and two-story
              surcharges are optional add-ons below.
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              Property Details
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTwoStory((v) => !v)}
                className={`${pillBase} ${twoStory ? pillSelected : pillIdle}`}
              >
                Two-Story (+{formatDollars(settings.twoStorySurcharge)})
              </button>
              <button
                type="button"
                onClick={() => setIncludeScreens((v) => !v)}
                className={`${pillBase} ${includeScreens ? pillSelected : pillIdle}`}
              >
                Screen Cleaning (+{formatDollars(settings.screenCleaningAddOn)})
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              Exterior Add-Ons
            </p>
            <p className="mt-1 text-xs text-muted">
              Member pricing applies {getMemberAddOnDiscountPercent(frequency, settings)}%
              off list for {frequency === "quarterly" ? "Quarterly" : "Bi-Annual"}{" "}
              members.
            </p>
            <div className="mt-4 space-y-4">
              {addOnSelections.map((selection) => (
                <div
                  key={selection.id}
                  className="rounded-2xl border border-border/70 bg-background/40 px-4 py-4"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selection.enabled}
                      onChange={(event) =>
                        updateAddOn(selection.id, { enabled: event.target.checked })
                      }
                      className="mt-1 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">
                        {EXTERIOR_ADDON_LABELS[selection.id]}
                      </span>
                      {selection.id === "soft_wash_exterior" && (
                        <span className="mt-1 block text-xs text-muted">
                          Flat {formatDollars(settings.exteriorAddOns.softWash.defaultPrice)}{" "}
                          typical · scales above{" "}
                          {settings.exteriorAddOns.softWash.largeHomeSqftThreshold.toLocaleString()}{" "}
                          sq ft
                        </span>
                      )}
                      {selection.id === "moss_removal" && (
                        <span className="mt-1 block text-xs text-muted">
                          ${settings.exteriorAddOns.mossRemoval.ratePerSqft}/sq ft on
                          affected areas only
                        </span>
                      )}
                      {selection.id === "pressure_wash_concrete" && (
                        <span className="mt-1 block text-xs text-muted">
                          ${settings.exteriorAddOns.pressureWashConcrete.ratePerSqft}/sq ft
                          concrete
                        </span>
                      )}
                      {selection.id === "screen_rescreening" && (
                        <span className="mt-1 block text-xs text-muted">
                          1–2 @ ${settings.exteriorAddOns.screenRescreening.singleScreenPrice}{" "}
                          · 3–5 @ $
                          {settings.exteriorAddOns.screenRescreening.midTierPricePerScreen}{" "}
                          · 6+ @ $
                          {settings.exteriorAddOns.screenRescreening.bulkPricePerScreen} each
                        </span>
                      )}
                    </span>
                  </label>
                  {selection.enabled &&
                    selection.id !== "soft_wash_exterior" &&
                    selection.id !== "screen_rescreening" && (
                      <label className="mt-3 block pl-7">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                          Area sq ft
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={selection.areaSqft ?? 0}
                          onChange={(event) =>
                            updateAddOn(selection.id, {
                              areaSqft: Number(event.target.value) || 0,
                            })
                          }
                          className="mt-2 w-full max-w-xs rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground outline-none focus:border-accent/40"
                        />
                        {selection.id === "moss_removal" && (
                          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                            {EXTERIOR_ADDON_AREA_GUIDANCE.moss_removal}
                          </p>
                        )}
                        {selection.id === "pressure_wash_concrete" && (
                          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                            {EXTERIOR_ADDON_AREA_GUIDANCE.pressure_wash_concrete}
                          </p>
                        )}
                      </label>
                    )}
                  {selection.enabled && selection.id === "screen_rescreening" && (
                    <label className="mt-3 block pl-7">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        Number of screens
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={selection.screenCount ?? 1}
                        onChange={(event) =>
                          updateAddOn(selection.id, {
                            screenCount: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })
                        }
                        className="mt-2 w-full max-w-xs rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground outline-none focus:border-accent/40"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
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

            {addOnQuote && addOnQuote.lineItems.length > 0 && (
              <section className="mt-6 rounded-[1.75rem] border border-border/70 bg-surface/30 p-6 sm:p-8">
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
                  Exterior Add-Ons
                </p>
                {memberSavingsLine && (
                  <p className="mt-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
                    {memberSavingsLine}
                  </p>
                )}
                {addOnQuote.memberDiscountPercent != null &&
                  addOnQuote.memberSavings <= 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {addOnQuote.memberDiscountPercent}% member discount on add-ons
                    when enrolled in{" "}
                    {frequency === "quarterly" ? "Quarterly" : "Bi-Annual"} care.
                  </p>
                )}
                <dl className="mt-4 space-y-3 text-sm">
                  {addOnQuote.lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4">
                      <dt className="min-w-0 text-muted">
                        <span className="block text-foreground/90">{item.label}</span>
                        <span className="mt-0.5 block text-xs">{item.detail}</span>
                        {item.listAmount !== item.amount && (
                          <span className="mt-0.5 block text-xs line-through">
                            List {formatDollars(item.listAmount)}
                          </span>
                        )}
                      </dt>
                      <dd className="shrink-0 font-serif text-lg font-light text-foreground">
                        {formatDollars(item.amount)}
                      </dd>
                    </div>
                  ))}
                  {addOnQuote.memberSavings > 0 && (
                    <div className="flex justify-between gap-4 border-t border-border/60 pt-3 text-xs">
                      <dt className="text-muted">Member savings</dt>
                      <dd className="text-emerald-400/90">
                        −{formatDollars(addOnQuote.memberSavings)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-border/60 pt-3">
                    <dt className="text-muted">Add-on subtotal</dt>
                    <dd className="font-serif text-xl font-light text-accent">
                      {formatDollars(addOnQuote.subtotal)}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {totalEstimate != null && (
              <section className="mt-6 rounded-[1.75rem] border border-accent/25 bg-accent/[0.06] p-6 sm:p-8">
                <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                  Quote Summary
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">
                      Window Care ({pricing?.frequencyLabel.toLowerCase()})
                    </dt>
                    <dd className="font-serif text-lg font-light text-foreground">
                      {formatDollars(recurringPrice)}
                    </dd>
                  </div>
                  {addOnQuote && addOnQuote.lineItems.length > 0 && (
                    <>
                      {addOnQuote.lineItems.map((item) => (
                        <div key={item.id} className="flex justify-between gap-4">
                          <dt className="text-muted">{item.label}</dt>
                          <dd className="text-foreground">
                            {formatDollars(item.amount)}
                          </dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 border-t border-border/60 pt-3">
                        <dt className="text-muted">Add-on subtotal</dt>
                        <dd>{formatDollars(addOnQuote.subtotal)}</dd>
                      </div>
                      {memberSavingsLine && (
                        <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3">
                          <p className="text-sm font-medium text-accent">
                            {memberSavingsLine}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {addOnQuote.memberDiscountPercent}% off add-ons while
                            membership payments are current.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between gap-4 border-t border-accent/30 pt-3">
                    <dt className="font-medium text-foreground">Total estimate</dt>
                    <dd className="font-serif text-2xl font-light text-accent">
                      {formatDollars(totalEstimate)}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

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
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleCopyQuote()}
                  className="flex-1 rounded-2xl border border-accent/30 bg-accent/10 px-6 py-4 text-sm font-medium tracking-[0.06em] text-accent transition-colors hover:border-accent/50"
                >
                  {copied ? "Copied ✓" : "Copy Quote Summary"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreatePresentation()}
                  disabled={creatingPresentation}
                  className="flex-1 rounded-2xl border border-border bg-surface px-6 py-4 text-sm font-medium tracking-[0.06em] text-foreground transition-colors hover:border-accent/30 disabled:opacity-60"
                >
                  {creatingPresentation ? "Creating…" : "Open in Presentation"}
                </button>
              </div>
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
