"use client";

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
import {
  addonSavingsExample,
  formatTierPrice,
  HARDWATER_RETAIL_VALUE,
  RAINBLOCK_RETAIL_VALUE,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import type { PresentationTier } from "@/lib/presentations/types";

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
  const addon = addonSavingsExample();

  return (
    <FullSlide>
      <Eyebrow>The math</Eyebrow>
      <HeroText>Quarterly pays for the upgrade.</HeroText>
      <div className="mt-8 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Included treatments (Quarterly)
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">RainBlock retail</span>
          <span>
            {formatTierPrice(RAINBLOCK_RETAIL_VALUE)} × 4 ={" "}
            {formatTierPrice(upgrade.rainblockAnnual)}/yr
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">Hard Water retail</span>
          <span>
            {formatTierPrice(HARDWATER_RETAIL_VALUE)} × 4 ={" "}
            {formatTierPrice(upgrade.hardWaterAnnual)}/yr
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-3">
          <span className="text-white/50">Included in Quarterly</span>
          <span className="text-accent">
            {formatTierPrice(upgrade.includedTreatmentValue)}/yr
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">Upgrade vs Bi-Annual</span>
          <span>{formatTierPrice(upgrade.upgradeCost)}/yr more</span>
        </div>
        <div className="flex justify-between gap-4 font-medium text-[#f5f2eb]">
          <span>Net advantage (treatments)</span>
          <span className="text-accent">
            {formatTierPrice(Math.max(0, upgrade.netAdvantage))} in your favor
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-lg border border-accent/20 bg-accent/[0.04] p-6 text-sm">
        <p className="text-[10px] uppercase tracking-[0.16em] text-accent/70">
          Add-on savings example
        </p>
        <p className="text-xs text-white/45">
          Screen cleaning ({formatTierPrice(addon.screenCleaning)}/visit) +
          interior windows ({formatTierPrice(addon.interiorWindows)}/visit) ={" "}
          {formatTierPrice(addon.perVisit)}/visit
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">
            Bi-Annual ({addon.biannualVisits} visits)
          </span>
          <span>
            {formatTierPrice(addon.biannualAddonTotal)} × 20% ={" "}
            {formatTierPrice(addon.biannualSavings)}/yr saved
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">
            Quarterly ({addon.quarterlyVisits} visits)
          </span>
          <span className="text-accent">
            {formatTierPrice(addon.quarterlyAddonTotal)} × 25% ={" "}
            {formatTierPrice(addon.quarterlySavings)}/yr saved
          </span>
        </div>
        <p className="border-t border-white/10 pt-3 text-xs text-white/40">
          The 25% Quarterly discount can save $200–300+ per year on add-ons alone
          — before RainBlock and Hard Water value.
        </p>
      </div>
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
  comparison: ComparisonSlide,
  savings: SavingsSlide,
  testimonials: TestimonialsSlide,
  guarantee: GuaranteeSlide,
  close: CloseSlide,
} as const;
