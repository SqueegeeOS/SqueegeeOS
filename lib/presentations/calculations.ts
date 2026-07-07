import {
  calculateAnnualFromVisits,
  calculateVisitPrice,
  normalizeToSqueegeeKingTier,
  quarterlyUpgradeMath,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import type { PresentationData, PresentationInput } from "./types";

/** In presentations, `monthlyRate` stores per-visit price. */
export function visitRateFromPresentation(
  data: Pick<
    PresentationData,
    "monthlyRate" | "tier" | "homeSqft" | "twoStory" | "includeScreens"
  >,
): number {
  if (data.monthlyRate > 0) return data.monthlyRate;
  return calculateVisitPrice(data.tier, data.homeSqft, {
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
  });
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
  const visitRate =
    input.monthlyRate && input.monthlyRate > 0
      ? input.monthlyRate
      : calculateVisitPrice(tier, input.homeSqft, pricingOpts);
  const annualRate = calculateAnnualFromVisits(tier, visitRate);
  const biannualVisit = calculateVisitPrice("biannual", input.homeSqft, pricingOpts);
  const quarterlyVisit = calculateVisitPrice(
    "quarterly",
    input.homeSqft,
    pricingOpts,
  );
  const upgrade = quarterlyUpgradeMath(biannualVisit, quarterlyVisit);

  const retailValue =
    input.retailValue && input.retailValue > 0
      ? input.retailValue
      : tier === "quarterly"
        ? QUARTERLY_INCLUDED_TREATMENT_ANNUAL
        : 0;

  return {
    tier,
    visitRate,
    monthlyRate: visitRate,
    annualRate,
    retailValue,
    biannualVisit,
    quarterlyVisit,
    upgrade,
    narrative: tier === "quarterly" ? ("savings" as const) : ("certainty" as const),
    certaintyCopy:
      "Both memberships protect your home with priority scheduling and automatic add-on discounts. Quarterly adds RainBlock, Hard Water protection, and 25% OFF every add-on.",
  };
}

export function withComputedRates(
  data: Partial<PresentationInput> & Pick<PresentationInput, "tier" | "homeSqft">,
): Pick<PresentationData, "monthlyRate" | "annualRate" | "retailValue"> {
  const rates = computePresentationRates({
    tier: data.tier,
    homeSqft: data.homeSqft,
    monthlyRate: data.monthlyRate,
    retailValue: data.retailValue,
  });
  return {
    monthlyRate: rates.visitRate,
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
