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
  data: Pick<PresentationData, "monthlyRate" | "tier" | "homeSqft" | "quoteSnapshot">,
): number {
  if (data.monthlyRate > 0) return data.monthlyRate;
  return calculateVisitPrice(data.tier, data.homeSqft, {
    twoStory: data.quoteSnapshot?.twoStory,
    includeScreens: data.quoteSnapshot?.includeScreens,
  });
}

export function computePresentationRates(input: {
  tier: string;
  homeSqft: number;
  monthlyRate?: number;
  retailValue?: number;
}) {
  const tier = normalizeToSqueegeeKingTier(input.tier);
  const visitRate =
    input.monthlyRate && input.monthlyRate > 0
      ? input.monthlyRate
      : calculateVisitPrice(tier, input.homeSqft);
  const annualRate = calculateAnnualFromVisits(tier, visitRate);
  const biannualVisit = calculateVisitPrice("biannual", input.homeSqft);
  const quarterlyVisit = calculateVisitPrice("quarterly", input.homeSqft);
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
