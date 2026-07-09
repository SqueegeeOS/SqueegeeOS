import {
  calculateAnnualFromVisits,
  calculateVisitPrice,
  memberYearlyWindowSavings,
  normalizeToSqueegeeKingTier,
  oneTimeRetailPerVisit,
  quarterlyUpgradeMath,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import type {
  PresentationData,
  PresentationInput,
  PresentationTier,
  VisitRateOverrides,
} from "./types";
import { tierCertaintyCopy } from "./tier-benefits";

export type PresentationPricingInput = Pick<
  PresentationData,
  | "tier"
  | "homeSqft"
  | "monthlyRate"
  | "overrideTier"
  | "visitRateOverrides"
> & {
  retailValue?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
};

/** `monthlyRate` > 0 means a legacy manual override on `overrideTier`. */
export function hasManualVisitRateOverride(
  monthlyRate: number | undefined | null,
): boolean {
  return typeof monthlyRate === "number" && monthlyRate > 0;
}

/** Merge JSON overrides with legacy monthly_rate + override_tier / presentation tier. */
export function normalizeVisitRateOverrides(
  data: Pick<
    PresentationData,
    "visitRateOverrides" | "monthlyRate" | "overrideTier" | "tier"
  >,
): VisitRateOverrides {
  const overrides: VisitRateOverrides = { ...(data.visitRateOverrides ?? {}) };

  if (hasManualVisitRateOverride(data.monthlyRate)) {
    const legacyTier = normalizeToSqueegeeKingTier(
      data.overrideTier ?? data.tier ?? "quarterly",
    );
    if (!overrides[legacyTier] || overrides[legacyTier]! <= 0) {
      overrides[legacyTier] = data.monthlyRate;
    }
  }

  return overrides;
}

export function tierVisitOverride(
  data: Pick<
    PresentationData,
    "visitRateOverrides" | "monthlyRate" | "overrideTier" | "tier"
  >,
  targetTier: SqueegeeKingTierId,
): number | null {
  const overrides = normalizeVisitRateOverrides(data);
  const value = overrides[targetTier];
  return typeof value === "number" && value > 0 ? value : null;
}

export function applyTierVisitOverride(
  data: Pick<
    PresentationData,
    "visitRateOverrides" | "monthlyRate" | "overrideTier" | "tier"
  >,
  tier: PresentationTier,
  value: number,
): Pick<PresentationData, "visitRateOverrides" | "monthlyRate" | "overrideTier"> {
  const scopedTier = normalizeToSqueegeeKingTier(tier);
  const overrides = normalizeVisitRateOverrides(data);

  if (value > 0) {
    overrides[scopedTier] = value;
  } else {
    delete overrides[scopedTier];
  }

  const editorTier = normalizeToSqueegeeKingTier(data.tier);
  const editorOverride = overrides[editorTier] ?? 0;

  return {
    visitRateOverrides: overrides,
    monthlyRate: editorOverride,
    overrideTier: editorOverride > 0 ? editorTier : null,
  };
}

export function legacyOverrideFieldsForTier(
  overrides: VisitRateOverrides,
  tier: PresentationTier,
): Pick<PresentationData, "monthlyRate" | "overrideTier"> {
  const scopedTier = normalizeToSqueegeeKingTier(tier);
  const value = overrides[scopedTier] ?? 0;
  return {
    monthlyRate: value,
    overrideTier: value > 0 ? scopedTier : null,
  };
}

/** Customer-facing per-visit price for the presentation's selected tier. */
export function visitRateFromPresentation(
  data: PresentationPricingInput,
): number {
  return computePresentationRates(data).visitRate;
}

export function tierVisitPriceForPresentation(
  data: PresentationPricingInput,
  targetTier: SqueegeeKingTierId,
): number {
  const rates = computePresentationRates(data);
  return targetTier === "biannual" ? rates.biannualVisit : rates.quarterlyVisit;
}

export function computePresentationRates(input: PresentationPricingInput) {
  const tier = normalizeToSqueegeeKingTier(input.tier);
  const pricingOpts = {
    twoStory: input.twoStory,
    includeScreens: input.includeScreens,
  };
  const overrides = normalizeVisitRateOverrides(input);

  let biannualVisit = calculateVisitPrice("biannual", input.homeSqft, pricingOpts);
  let quarterlyVisit = calculateVisitPrice(
    "quarterly",
    input.homeSqft,
    pricingOpts,
  );

  const biannualOverride = overrides.biannual;
  const quarterlyOverride = overrides.quarterly;
  if (biannualOverride && biannualOverride > 0) {
    biannualVisit = biannualOverride;
  }
  if (quarterlyOverride && quarterlyOverride > 0) {
    quarterlyVisit = quarterlyOverride;
  }

  const visitRate = tier === "biannual" ? biannualVisit : quarterlyVisit;
  const activeOverride = tier === "biannual" ? biannualOverride : quarterlyOverride;

  const annualRate = calculateAnnualFromVisits(tier, visitRate);
  const upgrade = quarterlyUpgradeMath(biannualVisit, quarterlyVisit);

  const retailValue =
    tier === "quarterly"
      ? input.retailValue && input.retailValue > 0
        ? input.retailValue
        : QUARTERLY_INCLUDED_TREATMENT_ANNUAL
      : 0;

  const yearlyWindowSavings = memberYearlyWindowSavings(visitRate, tier);
  const oneTimePerVisit = oneTimeRetailPerVisit(visitRate, tier);
  const biannualYearlyWindowSavings = memberYearlyWindowSavings(
    biannualVisit,
    "biannual",
  );
  const quarterlyYearlyWindowSavings = memberYearlyWindowSavings(
    quarterlyVisit,
    "quarterly",
  );

  return {
    tier,
    visitRate,
    monthlyRate: activeOverride && activeOverride > 0 ? activeOverride : 0,
    annualRate,
    retailValue,
    biannualVisit,
    quarterlyVisit,
    oneTimePerVisit,
    yearlyWindowSavings,
    biannualYearlyWindowSavings,
    quarterlyYearlyWindowSavings,
    quarterlyYearlyTotalValue:
      tier === "quarterly"
        ? quarterlyYearlyWindowSavings + retailValue
        : 0,
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
): Pick<
  PresentationData,
  "monthlyRate" | "overrideTier" | "visitRateOverrides" | "annualRate" | "retailValue"
> {
  const visitRateOverrides = normalizeVisitRateOverrides({
    tier: data.tier,
    monthlyRate: data.monthlyRate ?? 0,
    overrideTier: data.overrideTier,
    visitRateOverrides: data.visitRateOverrides,
  });
  const rates = computePresentationRates({
    tier: data.tier,
    homeSqft: data.homeSqft,
    monthlyRate: data.monthlyRate ?? 0,
    overrideTier: data.overrideTier,
    visitRateOverrides,
    retailValue: data.retailValue,
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
  });
  const legacy = legacyOverrideFieldsForTier(visitRateOverrides, data.tier);

  return {
    visitRateOverrides,
    monthlyRate: legacy.monthlyRate,
    overrideTier: legacy.overrideTier,
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
