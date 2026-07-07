"use client";

import { useState } from "react";
import {
  BigNumber,
  Eyebrow,
  FullSlide,
  HeroText,
  PricingColumn,
  ScheduleList,
  ServicesList,
  SubText,
  TierBadge,
  TierComparisonTable,
  TwoColumn,
  type PresentationData,
  type SlideOverride,
} from "../slide-primitives";
import { computePresentationRates } from "@/lib/presentations/calculations";
import { formatDollars, memberSavingsQuoteLine } from "@/lib/pricing/format";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_SCHEDULE_BODY,
  MEMBERSHIP_BILLING_SCHEDULE_HEADLINE,
} from "@/lib/agreement/agreement-content";
import {
  formatTierPrice,
  HARDWATER_RETAIL_VALUE,
  RAINBLOCK_RETAIL_VALUE,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import type { PresentationTier } from "@/lib/presentations/types";
import { quarterlyComplimentaryLine, quarterlySavingsLine } from "@/lib/presentations/upgrade-copy";

interface SlideComponentProps {
  presentation: PresentationData;
  overrides?: SlideOverride;
  onSign?: (tier: PresentationTier) => void;
}

export function CoverSlide({ presentation, overrides }: SlideComponentProps) {
  return (
    <FullSlide background="radial-gradient(ellipse at center, #0d0d0d 0%, #060606 100%)">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent/60">
          SqueegeeKing
        </p>
        <Eyebrow>Prepared exclusively for</Eyebrow>
        <HeroText>{overrides?.headline ?? presentation.clientName}</HeroText>
        <SubText>{presentation.clientAddress || "Your property"}</SubText>
        <TierBadge tier={presentation.tier} />
      </div>
    </FullSlide>
  );
}

export function ProblemSlide({ presentation, overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>The problem</Eyebrow>
      <HeroText>{overrides?.headline ?? "Maintenance fails in bursts."}</HeroText>
      <SubText>
        {overrides?.body ??
          `${presentation.clientName}, most homeowners react to problems instead of preventing them — windows streak, hard water returns, and the schedule lives in your head.`}
      </SubText>
    </FullSlide>
  );
}

export function SolutionSlide({ overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>The SqueegeeKing solution</Eyebrow>
      <HeroText>{overrides?.headline ?? "Rhythm replaces reaction."}</HeroText>
      <SubText>
        {overrides?.body ??
          "We steward your home on a calendar — documented visits, VIP scheduling, locked member pricing, and a team that knows your property before they arrive."}
      </SubText>
    </FullSlide>
  );
}

export function ServicesSlide({ presentation, overrides }: SlideComponentProps) {
  const def = SQUEEGEEKING_TIERS[presentation.tier];
  return (
    <FullSlide>
      <Eyebrow>{def.label} membership includes</Eyebrow>
      <HeroText>{overrides?.highlight ?? def.tagline}</HeroText>
      <ServicesList presentation={presentation} />
    </FullSlide>
  );
}

export function ScheduleSlide({ presentation }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>Your annual rhythm</Eyebrow>
      <HeroText>Scheduled before you ask.</HeroText>
      <ScheduleList presentation={presentation} />
    </FullSlide>
  );
}

export function PricingSlide({ presentation, overrides }: SlideComponentProps) {
  const rates = computePresentationRates(presentation);

  return (
    <FullSlide>
      <Eyebrow>{overrides?.headline ?? "Choose your level of protection"}</Eyebrow>
      <HeroText>Two memberships. One standard of care.</HeroText>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <PricingColumn tier="biannual" visitPrice={rates.biannualVisit} />
        <PricingColumn
          tier="quarterly"
          visitPrice={rates.quarterlyVisit}
          highlighted
        />
      </div>
    </FullSlide>
  );
}

export function CustomQuoteSlide({ presentation, overrides }: SlideComponentProps) {
  const snapshot = presentation.quoteSnapshot;
  if (!snapshot) {
    return (
      <FullSlide>
        <Eyebrow>Your quote</Eyebrow>
        <HeroText>No custom quote attached.</HeroText>
      </FullSlide>
    );
  }

  const { exteriorAddOnQuote: addOns } = snapshot;
  const lineItems = addOns?.lineItems ?? [];
  const tierLabel =
    snapshot.frequency === "quarterly" ? "Quarterly" : "Bi-Annual";

  return (
    <FullSlide>
      <Eyebrow>{overrides?.headline ?? "Your custom quote"}</Eyebrow>
      <HeroText>
        {tierLabel} care for {snapshot.sqft.toLocaleString()} sq ft
      </HeroText>
      <div className="mt-8 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm">
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <span className="text-white/50">
            Window Care ({snapshot.frequencyLabel.toLowerCase()})
          </span>
          <span className="font-serif text-lg text-[#f5f2eb]">
            {formatDollars(snapshot.windowCareVisitPrice)}
          </span>
        </div>
        {lineItems.map((item) => (
          <div key={item.id} className="flex justify-between gap-4">
            <span className="min-w-0 text-white/50">
              <span className="block text-[#f5f2eb]/90">{item.label}</span>
              <span className="text-xs">{item.detail}</span>
            </span>
            <span className="shrink-0 text-[#f5f2eb]">
              {item.listAmount !== item.amount ? (
                <>
                  <span className="block text-xs text-white/35 line-through">
                    {formatDollars(item.listAmount)}
                  </span>
                  {formatDollars(item.amount)}
                </>
              ) : (
                formatDollars(item.amount)
              )}
            </span>
          </div>
        ))}
        {lineItems.length > 0 && (
          <div className="flex justify-between gap-4 border-t border-white/10 pt-3">
            <span className="text-white/50">Add-on subtotal</span>
            <span className="text-accent">{formatDollars(addOns?.subtotal ?? 0)}</span>
          </div>
        )}
        {(addOns?.memberSavings ?? 0) > 0 && (
          <p className="mt-4 rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {memberSavingsQuoteLine(
              snapshot.frequency,
              addOns?.memberSavings ?? 0,
            )}
          </p>
        )}
        <div className="flex justify-between gap-4 border-t border-accent/20 pt-3 font-medium">
          <span className="text-[#f5f2eb]">Total estimate</span>
          <span className="font-serif text-xl text-accent">
            {formatDollars(snapshot.totalEstimate)}
          </span>
        </div>
      </div>
      <SubText>
        Same numbers from your Care Plan Builder — window care plus selected
        exterior add-ons at member pricing.
      </SubText>
    </FullSlide>
  );
}

export function ComparisonSlide({ overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>Tier comparison</Eyebrow>
      <HeroText>{overrides?.headline ?? "Side by side."}</HeroText>
      <SubText>
        {overrides?.body ??
          "Both memberships include priority scheduling, locked pricing, and automatic add-on discounts — 20% on Bi-Annual, 25% on Quarterly. Quarterly adds RainBlock and Hard Water protection every visit."}
      </SubText>
      <TierComparisonTable />
    </FullSlide>
  );
}

export function SavingsSlide({ presentation }: SlideComponentProps) {
  const rates = computePresentationRates(presentation);
  const { upgrade } = rates;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const savingsLine = quarterlySavingsLine(upgrade);

  return (
    <FullSlide>
      <Eyebrow>The math</Eyebrow>
      <HeroText>Quarterly Benefits</HeroText>

      <div className="mt-8 max-w-2xl space-y-5 text-base leading-relaxed text-white/60 sm:text-lg">
        {savingsLine ? <p>{savingsLine}</p> : null}
        <p>{quarterlyComplimentaryLine(upgrade)}</p>
      </div>

      <button
        type="button"
        onClick={() => setShowBreakdown((open) => !open)}
        className="mt-8 text-xs text-accent/80 underline-offset-4 hover:text-accent hover:underline"
      >
        {showBreakdown ? "Hide breakdown" : "View breakdown"}
      </button>

      {showBreakdown ? (
        <div className="mt-4 space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Yearly plan investment
            </p>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Bi-Annual</span>
              <span>{formatTierPrice(upgrade.biannualAnnual)}/yr</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Quarterly</span>
              <span>{formatTierPrice(upgrade.quarterlyAnnual)}/yr</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Additional cost to upgrade</span>
              <span>{formatTierPrice(upgrade.upgradeCost)}/yr</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Complimentary services at retail
            </p>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">RainBlock Technology</span>
              <span>
                {formatTierPrice(RAINBLOCK_RETAIL_VALUE)}/visit × 4 ={" "}
                {formatTierPrice(upgrade.rainblockAnnual)}/yr
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Hard Water Removal</span>
              <span>
                {formatTierPrice(HARDWATER_RETAIL_VALUE)}/visit × 4 ={" "}
                {formatTierPrice(upgrade.hardWaterAnnual)}/yr
              </span>
            </div>
            <div className="flex justify-between gap-4 font-medium">
              <span className="text-[#f5f2eb]">Total retail value</span>
              <span className="text-accent">
                {formatTierPrice(upgrade.includedTreatmentValue)}/yr
              </span>
            </div>
          </div>

          {upgrade.netAdvantage > 0 ? (
            <p className="border-t border-white/10 pt-4 text-xs text-white/40">
              Net savings vs. Bi-Annual plus separate treatments:{" "}
              {formatTierPrice(upgrade.netAdvantage)}/yr
            </p>
          ) : null}
        </div>
      ) : null}
    </FullSlide>
  );
}

export function TestimonialsSlide({ overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>Member stories</Eyebrow>
      <HeroText>{overrides?.highlight ?? "Homes that stay ready."}</HeroText>
      <SubText>
        &ldquo;Most homeowners who start Bi-Annual upgrade within the first year
        once they see how the windows hold up between visits.&rdquo;
      </SubText>
    </FullSlide>
  );
}

export function GuaranteeSlide({ overrides }: SlideComponentProps) {
  return (
    <FullSlide>
      <Eyebrow>Our guarantee</Eyebrow>
      <HeroText>Seven days. No excuses.</HeroText>
      <SubText>
        {overrides?.body ??
          "Every visit is backed by our 7-Day Workmanship Guarantee — if it's not right, we return within seven days. Cancel anytime with thirty days written notice."}
      </SubText>
    </FullSlide>
  );
}

export function CloseSlide({ presentation, overrides, onSign }: SlideComponentProps) {
  const rates = computePresentationRates(presentation);

  return (
    <FullSlide background="radial-gradient(ellipse at 50% 40%, #0f0d08 0%, #060606 100%)">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Ready to protect your home</Eyebrow>
        <HeroText>{overrides?.headline ?? "Let's get started."}</HeroText>
        <SubText>
          {overrides?.body ??
            (presentation.customNotes ||
              `${presentation.clientName}, choose the membership that fits your home. We recommend Quarterly for year-round protection.`)}
        </SubText>

        <div className="mx-auto mt-8 max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-5 text-left">
          <p className="font-serif text-sm italic leading-relaxed text-accent/80">
            {MEMBERSHIP_BILLING_PHILOSOPHY}
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-accent/70">
            {MEMBERSHIP_BILLING_SCHEDULE_HEADLINE}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            {MEMBERSHIP_BILLING_SCHEDULE_BODY}
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onSign?.("biannual")}
            className="rounded border border-white/20 px-8 py-4 text-sm font-semibold text-[#f5f2eb] transition hover:border-white/40"
          >
            Sign — Bi-Annual ({formatTierPrice(rates.biannualVisit)}/visit)
          </button>
          <button
            type="button"
            onClick={() => onSign?.("quarterly")}
            className="rounded bg-gradient-to-br from-accent via-[#e8d5a3] to-accent px-8 py-4 text-sm font-bold text-[#060606] shadow-[0_0_40px_rgba(197,168,105,0.3)]"
          >
            Sign — Quarterly ✦ Recommended ({formatTierPrice(rates.quarterlyVisit)}
            /visit)
          </button>
        </div>

        <p className="mt-5 text-xs text-white/25">
          Legally binding · PDF emailed · Cancel with 30 days notice
        </p>
      </div>
    </FullSlide>
  );
}

export const SLIDE_COMPONENTS = {
  cover: CoverSlide,
  problem: ProblemSlide,
  solution: SolutionSlide,
  services: ServicesSlide,
  schedule: ScheduleSlide,
  pricing: PricingSlide,
  custom_quote: CustomQuoteSlide,
  comparison: ComparisonSlide,
  savings: SavingsSlide,
  testimonials: TestimonialsSlide,
  guarantee: GuaranteeSlide,
  close: CloseSlide,
} as const;
