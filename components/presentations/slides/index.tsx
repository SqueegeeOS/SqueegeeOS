"use client";

import { useState } from "react";
import {
  Eyebrow,
  FullSlide,
  HeroText,
  PricingColumn,
  TierBadge,
} from "../slide-primitives";
import {
  DifferenceVisual,
  ExpandLink,
  IconBullet,
  IncludedVisual,
  ProcessTimeline,
} from "./visual-primitives";
import { computePresentationRates } from "@/lib/presentations/calculations";
import { formatDollars, memberSavingsQuoteLine } from "@/lib/pricing/format";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_REMINDER,
} from "@/lib/agreement/agreement-content";
import { formatTierPrice, SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";
import type { PresentationTier } from "@/lib/presentations/types";
import {
  quarterlyComplimentaryLine,
  quarterlySavingsLine,
} from "@/lib/presentations/upgrade-copy";
import type { PresentationData, SlideOverride } from "@/lib/presentations/types";

interface SlideComponentProps {
  presentation: PresentationData;
  overrides?: SlideOverride;
  onSign?: (tier: PresentationTier) => void;
}

export function CoverSlide({ presentation, overrides }: SlideComponentProps) {
  return (
    <FullSlide background="radial-gradient(ellipse at 50% 30%, rgba(18,16,10,0.85) 0%, transparent 70%)">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-accent/70">
          SqueegeeKing
        </p>
        <div className="mx-auto mt-6 mb-8 h-px w-12 bg-accent/25" aria-hidden />
        <Eyebrow>Prepared for</Eyebrow>
        <HeroText>{overrides?.headline ?? presentation.clientName}</HeroText>
        <p className="mt-5 text-lg text-white/55">
          {presentation.clientAddress || "Your property"}
        </p>
        <TierBadge tier={presentation.tier} />
      </div>
    </FullSlide>
  );
}

export function IncludedSlide({ presentation, overrides }: SlideComponentProps) {
  const def = SQUEEGEEKING_TIERS[presentation.tier];
  return (
    <FullSlide>
      <div className="mx-auto max-w-4xl text-center">
        <Eyebrow>What&apos;s included</Eyebrow>
        <HeroText>{overrides?.highlight ?? "Complete care, every visit."}</HeroText>
        <p className="mt-4 text-sm tracking-wide text-white/55">
          {def.label} · {def.visitsPerYear} visits per year
        </p>
        <IncludedVisual />
      </div>
    </FullSlide>
  );
}

export function DifferenceSlide({ overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <div className="mx-auto max-w-4xl">
        <Eyebrow>The difference</Eyebrow>
        <HeroText>{overrides?.headline ?? "Obvious, once you see it."}</HeroText>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          {overrides?.body ??
            "Rhythm, documentation, and premium treatments — not one-off window cleaning."}
        </p>
        <DifferenceVisual />
      </div>
    </FullSlide>
  );
}

export function InvestmentSlide({ presentation, overrides }: SlideComponentProps) {
  const rates = computePresentationRates(presentation);
  const { upgrade } = rates;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const savingsLine = quarterlySavingsLine(upgrade);

  return (
    <FullSlide>
      <div className="mx-auto max-w-4xl">
        <Eyebrow>{overrides?.headline ?? "Your plan"}</Eyebrow>
        <HeroText>Simple. Transparent.</HeroText>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <PricingColumn tier="biannual" visitPrice={rates.biannualVisit} />
          <PricingColumn
            tier="quarterly"
            visitPrice={rates.quarterlyVisit}
            highlighted
          />
        </div>

        <div className="mt-8 rounded-2xl border border-accent/20 bg-accent/[0.05] p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.16em] text-accent/70">
            Why Quarterly
          </p>
          <div className="mt-3 space-y-2 text-base leading-relaxed text-white/60">
            {savingsLine ? <p>{savingsLine}</p> : null}
            <p className="text-[#f5f2eb]/90">{quarterlyComplimentaryLine(upgrade)}</p>
          </div>
          <div className="mt-4">
            <ExpandLink
              open={showBreakdown}
              onClick={() => setShowBreakdown((v) => !v)}
            />
          </div>
          {showBreakdown ? (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-white/50">
              <div className="flex justify-between gap-4">
                <span>Bi-Annual / year</span>
                <span>{formatTierPrice(upgrade.biannualAnnual)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Quarterly / year</span>
                <span>{formatTierPrice(upgrade.quarterlyAnnual)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>RainBlock + Hard Water retail</span>
                <span>{formatTierPrice(upgrade.includedTreatmentValue)}/yr</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </FullSlide>
  );
}

export function ProcessSlide({ presentation }: SlideComponentProps) {
  const tier = SQUEEGEEKING_TIERS[presentation.tier];
  return (
    <FullSlide>
      <div className="mx-auto max-w-4xl text-center">
        <Eyebrow>How it works</Eyebrow>
        <HeroText>We handle everything.</HeroText>
        <p className="mt-4 text-sm tracking-wide text-white/55">
          {tier.frequency} visits · {tier.visitsPerYear} per year · billed on the 1st
        </p>
        <ProcessTimeline />
        <p className="mx-auto mt-10 max-w-lg font-serif text-sm italic leading-relaxed text-accent/75">
          {MEMBERSHIP_BILLING_PHILOSOPHY}
        </p>
      </div>
    </FullSlide>
  );
}

export function CustomQuoteSlide({ presentation, overrides }: SlideComponentProps) {
  const snapshot = presentation.quoteSnapshot;
  if (!snapshot) {
    return (
      <FullSlide>
        <HeroText>Your custom quote</HeroText>
      </FullSlide>
    );
  }

  const { exteriorAddOnQuote: addOns } = snapshot;
  const lineItems = addOns?.lineItems ?? [];
  const freqLabel =
    snapshot.frequency === "quarterly" ? "Quarterly" : "Bi-Annual";

  return (
    <FullSlide>
      <Eyebrow>{overrides?.headline ?? "Your quote"}</Eyebrow>
      <HeroText>
        {freqLabel} · {snapshot.sqft.toLocaleString()} sq ft
      </HeroText>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex justify-between gap-4 border-b border-white/10 pb-4 text-sm">
          <span className="text-white/50">Window care</span>
          <span className="font-serif text-xl text-[#f5f2eb]">
            {formatDollars(snapshot.windowCareVisitPrice)}
          </span>
        </div>
        {lineItems.length > 0 ? (
          <div className="mt-4 space-y-2 text-sm">
            {lineItems.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span className="text-white/50">{item.label}</span>
                <span>{formatDollars(item.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {(addOns?.memberSavings ?? 0) > 0 ? (
          <p className="mt-4 text-sm text-accent">
            {memberSavingsQuoteLine(snapshot.frequency, addOns?.memberSavings ?? 0)}
          </p>
        ) : null}
        <div className="mt-4 flex justify-between gap-4 border-t border-accent/20 pt-4">
          <span className="text-[#f5f2eb]">Total</span>
          <span className="font-serif text-2xl text-accent">
            {formatDollars(snapshot.totalEstimate)}
          </span>
        </div>
      </div>
    </FullSlide>
  );
}

export function CloseSlide({ presentation, overrides, onSign }: SlideComponentProps) {
  const rates = computePresentationRates(presentation);

  return (
    <FullSlide background="radial-gradient(ellipse at 50% 35%, rgba(15,13,8,0.85) 0%, transparent 75%)">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Ready to begin</Eyebrow>
        <HeroText>
          {overrides?.headline ?? `Let's care for your home, ${presentation.clientName.split(" ")[0]}.`}
        </HeroText>

        <ul className="mx-auto mt-10 max-w-md space-y-4">
          <IconBullet icon="✓">Nothing to pay at signing today</IconBullet>
          <IconBullet icon="✓">Billed on the 1st of your scheduled service month</IconBullet>
          <IconBullet icon="✓">No payment when we arrive — care stays at the center</IconBullet>
        </ul>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onSign?.("biannual")}
            className="min-h-[52px] rounded-xl border border-white/20 bg-white/[0.03] px-8 py-4 text-sm font-medium text-[#f5f2eb] transition-colors duration-200 hover:border-white/40 hover:bg-white/[0.06] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
          >
            Bi-Annual · {formatTierPrice(rates.biannualVisit)}/visit
          </button>
          <button
            type="button"
            onClick={() => onSign?.("quarterly")}
            className="min-h-[52px] rounded-xl bg-gradient-to-br from-accent via-[#e8d5a3] to-accent px-8 py-4 text-sm font-semibold text-[#060606] shadow-[0_0_40px_rgba(201,184,150,0.25)] transition-shadow duration-300 hover:shadow-[0_0_56px_rgba(201,184,150,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
          >
            Quarterly · {formatTierPrice(rates.quarterlyVisit)}/visit
          </button>
        </div>

        <p className="mt-6 text-[11px] tracking-wide text-white/40">
          7-day guarantee · PDF agreement · {MEMBERSHIP_BILLING_REMINDER.split(".")[0]}
        </p>
        <p className="mt-10 text-[10px] uppercase tracking-[0.28em] text-white/25">
          Powered by HomeAtlas
        </p>
      </div>
    </FullSlide>
  );
}

export const SLIDE_COMPONENTS = {
  cover: CoverSlide,
  included: IncludedSlide,
  difference: DifferenceSlide,
  investment: InvestmentSlide,
  process: ProcessSlide,
  custom_quote: CustomQuoteSlide,
  close: CloseSlide,
} as const;
