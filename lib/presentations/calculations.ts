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
import { resolveEnrollmentSavings } from "@/lib/membership/enrollment-savings";
import { tierCertaintyCopy } from "./tier-benefits";

type VisitRateState = Pick<PresentationData, "tier"> &
  Partial<
    Pick<
      PresentationData,
      "monthlyRate" | "overrideTier" | "visitRateOverrides"
    >
  > & {
    homeSqft?: number;
  };

export type PresentationPricingInput = Pick<
  PresentationData,
  "tier" | "homeSqft"
> &
  Partial<
    Pick<
      PresentationData,
      "monthlyRate" | "overrideTier" | "visitRateOverrides"
    >
  > & {
  enrollmentSavings?: number;
  retailValue?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
  includeInterior?: boolean;
};

/** `monthlyRate` > 0 means a legacy manual override on `overrideTier`. */
export function hasManualVisitRateOverride(
  monthlyRate: number | undefined | null,
): boolean {
  return typeof monthlyRate === "number" && monthlyRate > 0;
}

/** Merge JSON overrides with legacy monthly_rate + override_tier / presentation tier. */
export function normalizeVisitRateOverrides(
  data: VisitRateState,
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
  data: VisitRateState,
  targetTier: SqueegeeKingTierId,
): number | null {
  const overrides = normalizeVisitRateOverrides(data);
  const value = overrides[targetTier];
  return typeof value === "number" && value > 0 ? value : null;
}

export function applyTierVisitOverride(
  data: VisitRateState,
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

export function enrollmentSavingsForPresentation(
  data: PresentationPricingInput,
  targetTier?: SqueegeeKingTierId,
): number {
  const tier = targetTier ?? normalizeToSqueegeeKingTier(data.tier);
  return resolveEnrollmentSavings(data.enrollmentSavings, tier);
}

export function computePresentationRates(input: PresentationPricingInput) {
  const tier = normalizeToSqueegeeKingTier(input.tier);
  const pricingOpts = {
    twoStory: input.twoStory,
    includeScreens: input.includeScreens,
    includeInterior: input.includeInterior,
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
  const enrollmentSavings = resolveEnrollmentSavings(
    input.enrollmentSavings,
    tier,
  );

  return {
    tier,
    visitRate,
    monthlyRate: activeOverride && activeOverride > 0 ? activeOverride : 0,
    annualRate,
    retailValue,
    enrollmentSavings,
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
      includeInterior?: boolean;
    },
): Pick<
  PresentationData,
  | "monthlyRate"
  | "overrideTier"
  | "visitRateOverrides"
  | "annualRate"
  | "retailValue"
  | "enrollmentSavings"
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
    enrollmentSavings: data.enrollmentSavings,
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
    includeInterior: data.includeInterior,
  });
  const legacy = legacyOverrideFieldsForTier(visitRateOverrides, data.tier);

  return {
    visitRateOverrides,
    monthlyRate: legacy.monthlyRate,
    overrideTier: legacy.overrideTier,
    annualRate: rates.annualRate,
    retailValue: rates.retailValue,
    enrollmentSavings: rates.enrollmentSavings,
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

/**
 * Builds a stable, presentation-scoped slug for records created during signing.
 * Human-readable name/address slugs alone are not identities: two customers can
 * share a name, and one customer can have multiple presentations. Scoping the
 * slug prevents an unrelated presentation from overwriting an existing record.
 */
export function scopedPresentationSlug(
  value: string,
  presentationId: string,
  fallback: string,
): string {
  const suffix = presentationId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);
  const base = slugifyPresentation(value) || slugifyPresentation(fallback) || "record";

  if (!suffix) {
    return base;
  }

  const availableBaseLength = Math.max(1, 48 - suffix.length - 1);
  const scopedBase = base.slice(0, availableBaseLength).replace(/-+$/g, "") || "record";
  return `${scopedBase}-${suffix}`;
}

export type { SqueegeeKingTierId };
