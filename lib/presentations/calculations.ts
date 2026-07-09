import {
  calculateAnnualFromVisits,
  calculateVisitPrice,
  normalizeToSqueegeeKingTier,
  quarterlyUpgradeMath,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import type { PresentationData, PresentationInput } from "./types";
import { tierCertaintyCopy } from "./tier-benefits";

/** `monthlyRate` > 0 means Noah entered a manual per-visit override. */
export function hasManualVisitRateOverride(
  monthlyRate: number | undefined | null,
): boolean {
  return typeof monthlyRate === "number" && monthlyRate > 0;
}

/** Customer-facing per-visit price — manual override wins over pricing engine. */
export function visitRateFromPresentation(
  data: Pick<
    PresentationData,
    "monthlyRate" | "tier" | "homeSqft" | "twoStory" | "includeScreens"
  >,
): number {
  return computePresentationRates(data).visitRate;
}

export function tierVisitPriceForPresentation(
  data: Pick<
    PresentationData,
    "monthlyRate" | "tier" | "homeSqft" | "twoStory" | "includeScreens"
  >,
  targetTier: SqueegeeKingTierId,
): number {
  const rates = computePresentationRates({ ...data, tier: targetTier });
  return targetTier === "biannual" ? rates.biannualVisit : rates.quarterlyVisit;
}

export function computePresentationRates(input: {
  tier: string;
  homeSqft: number;
  monthlyRate?: number;
  retailValue?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
}) {
  const tier = normalizeToSqueegeeKingTier(input.tier);
  const pricingOpts = {
    twoStory: input.twoStory,
    includeScreens: input.includeScreens,
  };
  const override = hasManualVisitRateOverride(input.monthlyRate)
    ? input.monthlyRate!
    : null;

  const computedForTier = calculateVisitPrice(tier, input.homeSqft, pricingOpts);
  const visitRate = override ?? computedForTier;

  let biannualVisit = calculateVisitPrice("biannual", input.homeSqft, pricingOpts);
  let quarterlyVisit = calculateVisitPrice(
    "quarterly",
    input.homeSqft,
    pricingOpts,
  );

  if (override != null) {
    if (tier === "biannual") biannualVisit = override;
    if (tier === "quarterly") quarterlyVisit = override;
  }

  const annualRate = calculateAnnualFromVisits(tier, visitRate);
  const upgrade = quarterlyUpgradeMath(biannualVisit, quarterlyVisit);

  const retailValue =
    tier === "quarterly"
      ? input.retailValue && input.retailValue > 0
        ? input.retailValue
        : QUARTERLY_INCLUDED_TREATMENT_ANNUAL
      : 0;

  return {
    tier,
    visitRate,
    /** Stored override only — 0 means "use pricing engine at display time". */
    monthlyRate: override ?? 0,
    annualRate,
    retailValue,
    biannualVisit,
    quarterlyVisit,
    upgrade,
    narrative: tier === "quarterly" ? ("savings" as const) : ("certainty" as const),
    certaintyCopy: tierCertaintyCopy(tier),
  };
}

export function withComputedRates(
  data: Partial<PresentationInput> &
    Pick<PresentationInput, "tier" | "homeSqft"> & {
      twoStory?: boolean;
      includeScreens?: boolean;
    },
): Pick<PresentationData, "monthlyRate" | "annualRate" | "retailValue"> {
  const rates = computePresentationRates({
    tier: data.tier,
    homeSqft: data.homeSqft,
    monthlyRate: data.monthlyRate,
    retailValue: data.retailValue,
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
  });

  return {
    monthlyRate: rates.monthlyRate,
    annualRate: rates.annualRate,
    retailValue: rates.retailValue,
  };
}

export function slugifyPresentation(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export type { SqueegeeKingTierId };
