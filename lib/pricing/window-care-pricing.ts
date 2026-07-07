/**
 * Atlas Pricing Engine v1.0
 *
 * Central pricing law for HomeAtlas / SqueegeeKing.
 * North star: trust first, consistency second — not just calculations.
 *
 * Residential exterior window care (Noah's field rules):
 * - Quarterly: sq ft × quarterly rate + two-story surcharge + optional screens
 * - Bi-annual: sq ft × bi-annual rate + two-story surcharge + optional screens
 * - One-time exterior: bi-annual visit math + one-time premium + optional screens
 *
 * @see docs/ATLAS_PRICING_ENGINE.md
 */
import {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  type CompanySettings,
} from "./company-settings";
import type {
  CareFrequency,
  ExteriorWindowPriceBreakdown,
  PricingComparison,
  PricingInput,
  PricingOutput,
  PricingRecommendation,
  PropertyContext,
} from "./types";

export {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  perThousandFromRate,
  settingsFromPerThousandSqft,
  validateCompanySettings,
} from "./company-settings";
export type { CompanySettings, ExteriorAddOnSettings } from "./company-settings";

export type {
  CareFrequency,
  CustomerRelationship,
  ExteriorWindowPriceBreakdown,
  PricingComparison,
  PricingInput,
  PricingOutput,
  PricingRecommendation,
  PropertyAccessFlags,
  PropertyContext,
  ServiceScope,
} from "./types";

export {
  applyMemberAddOnDiscount,
  calculateExteriorAddOnQuote,
  calculateMossRemovalQuote,
  calculatePressureWashConcreteQuote,
  calculateScreenRescreeningQuote,
  calculateSoftWashQuote,
  defaultExteriorAddOnSelections,
  EXTERIOR_ADDON_LABELS,
  getMemberAddOnDiscountPercent,
} from "./exterior-addon-pricing";
export type {
  ExteriorAddOnId,
  ExteriorAddOnLineItem,
  ExteriorAddOnQuote,
  ExteriorAddOnSelection,
} from "./types";

const FREQUENCY_LABELS: Record<CareFrequency, string> = {
  quarterly: "Every 3 Months",
  bi_annual: "Every 6 Months",
};

export const PRICING_SQFT_PRESETS = [1000, 1400, 1500, 2500, 3000] as const;

export function getMinSqft(settings: CompanySettings = DEFAULT_COMPANY_SETTINGS): number {
  return settings.minimumQuoteSqft;
}

export function getMaxSqft(settings: CompanySettings = DEFAULT_COMPANY_SETTINGS): number {
  return settings.maximumQuoteSqft;
}

export function validateInput(
  input: PricingInput,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): string | null {
  const min = settings.minimumQuoteSqft;
  const max = settings.maximumQuoteSqft;

  if (!input.squareFeet || input.squareFeet <= 0) {
    return "Square footage must be greater than zero.";
  }
  if (input.squareFeet < min) {
    return `Minimum square footage is ${min}.`;
  }
  if (input.squareFeet > max) {
    return `Maximum square footage is ${max}.`;
  }
  return null;
}

export function buildExteriorWindowBreakdown(
  squareFeet: number,
  frequency: CareFrequency,
  options: {
    twoStory?: boolean;
    includeScreens?: boolean;
  } = {},
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): ExteriorWindowPriceBreakdown {
  const resolved = normalizeCompanySettings(settings);
  const sqftBase = Math.floor(
    squareFeet * resolved.rates[frequency].ratePerSqft,
  );
  const twoStorySurcharge = options.twoStory
    ? resolved.twoStorySurcharge
    : 0;
  const screenCleaning = options.includeScreens
    ? resolved.screenCleaningAddOn
    : 0;

  return {
    sqftBase,
    twoStorySurcharge,
    screenCleaning,
    visitTotal: sqftBase + twoStorySurcharge + screenCleaning,
  };
}

export function calculateExteriorPrice(
  sqft: number,
  frequency: CareFrequency,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
  options: { twoStory?: boolean; includeScreens?: boolean } = {},
): number {
  return buildExteriorWindowBreakdown(sqft, frequency, options, settings)
    .visitTotal;
}

export function calculateInteriorExteriorPrice(
  exteriorPrice: number,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  return Math.round(exteriorPrice * settings.interiorMultiplier);
}

export function calculateOneTimeExteriorPrice(
  input: Pick<PricingInput, "squareFeet" | "twoStory" | "includeScreens">,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  const resolved = normalizeCompanySettings(settings);
  const biAnnualVisit = buildExteriorWindowBreakdown(
    input.squareFeet,
    "bi_annual",
    { twoStory: input.twoStory, includeScreens: false },
    resolved,
  );
  const screens = input.includeScreens ? resolved.screenCleaningAddOn : 0;
  return biAnnualVisit.visitTotal + resolved.oneTimePremium + screens;
}

/** @deprecated Use calculateOneTimeExteriorPrice for exterior scope. */
export function calculateOneTimePrice(
  memberPrice: number,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  return Math.round(memberPrice + settings.oneTimePremium);
}

export function buildPricingRecommendation(
  _input: PricingInput,
  _output: Omit<PricingOutput, "recommendation">,
  _context?: PropertyContext,
): PricingRecommendation | undefined {
  return undefined;
}

export function calculateWindowCarePricing(
  input: PricingInput,
  context?: PropertyContext,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): PricingOutput {
  const resolved = normalizeCompanySettings(settings);
  const rateConfig = resolved.rates[input.frequency];
  const frequencyLabel = FREQUENCY_LABELS[input.frequency];

  const exteriorBreakdown = buildExteriorWindowBreakdown(
    input.squareFeet,
    input.frequency,
    {
      twoStory: input.twoStory,
      includeScreens: input.includeScreens,
    },
    resolved,
  );

  const oneTimeExteriorBreakdown: ExteriorWindowPriceBreakdown = {
    ...buildExteriorWindowBreakdown(
      input.squareFeet,
      "bi_annual",
      { twoStory: input.twoStory, includeScreens: false },
      resolved,
    ),
    screenCleaning: input.includeScreens ? resolved.screenCleaningAddOn : 0,
    visitTotal: 0,
  };
  oneTimeExteriorBreakdown.visitTotal =
    oneTimeExteriorBreakdown.sqftBase +
    oneTimeExteriorBreakdown.twoStorySurcharge +
    resolved.oneTimePremium +
    oneTimeExteriorBreakdown.screenCleaning;

  const exteriorMemberPrice = exteriorBreakdown.visitTotal;
  const interiorExteriorMemberPrice = calculateInteriorExteriorPrice(
    exteriorMemberPrice,
    resolved,
  );

  const exteriorOneTimePrice = oneTimeExteriorBreakdown.visitTotal;

  const biAnnualExteriorForInterior = buildExteriorWindowBreakdown(
    input.squareFeet,
    "bi_annual",
    { twoStory: input.twoStory, includeScreens: false },
    resolved,
  ).visitTotal;
  const interiorExteriorOneTimePrice =
    calculateInteriorExteriorPrice(biAnnualExteriorForInterior, resolved) +
    resolved.oneTimePremium +
    (input.includeScreens ? resolved.screenCleaningAddOn : 0);

  const annualExteriorValue = exteriorMemberPrice * rateConfig.annualVisits;
  const annualInteriorExteriorValue =
    interiorExteriorMemberPrice * rateConfig.annualVisits;

  const notes: string[] = [];
  const exclusions: string[] = [
    "Tracks, frames, and sills are not included in base pricing.",
    "Hard water restoration beyond package allowance is priced separately.",
    "Heavy debris, oxidation, and construction residue are priced separately.",
  ];

  if (!input.includeScreens) {
    exclusions.push(
      `Screen cleaning is optional (+${resolved.screenCleaningAddOn}).`,
    );
  } else {
    notes.push(
      `Screen cleaning included (+${resolved.screenCleaningAddOn} per visit).`,
    );
  }

  if (input.twoStory) {
    notes.push(
      `Two-story surcharge applied (+${resolved.twoStorySurcharge}).`,
    );
  }

  if (input.frequency === "quarterly") {
    notes.push(
      "Every 3 Months care qualifies for RainBlock Technology and complimentary hard water treatment where included in package.",
    );
  }

  notes.push(
    `One-time exterior visits are based on the Every 6 Months rate plus a ${resolved.oneTimePremium} service premium.`,
  );

  const base: Omit<PricingOutput, "recommendation"> = {
    frequencyLabel,
    annualVisits: rateConfig.annualVisits,
    exteriorMemberPrice,
    interiorExteriorMemberPrice,
    exteriorOneTimePrice,
    interiorExteriorOneTimePrice,
    annualExteriorValue,
    annualInteriorExteriorValue,
    oneTimePremium: resolved.oneTimePremium,
    notes,
    exclusions,
    exteriorBreakdown,
    oneTimeExteriorBreakdown,
  };

  const recommendation = buildPricingRecommendation(input, base, context);

  return recommendation ? { ...base, recommendation } : base;
}

export function getPricingComparison(
  input: PricingInput,
  context?: PropertyContext,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): PricingComparison {
  const output = calculateWindowCarePricing(input, context, settings);
  return {
    recurringExterior: output.exteriorMemberPrice,
    recurringInteriorExterior: output.interiorExteriorMemberPrice,
    oneTimeExterior: output.exteriorOneTimePrice,
    oneTimeInteriorExterior: output.interiorExteriorOneTimePrice,
    differenceExterior: output.exteriorOneTimePrice - output.exteriorMemberPrice,
    differenceInteriorExterior:
      output.interiorExteriorOneTimePrice - output.interiorExteriorMemberPrice,
    frequencyLabel: output.frequencyLabel,
  };
}

/** Bridge for presentations / membership quotes — Law 008 single source. */
export function visitPriceForMembershipTier(
  tier: "quarterly" | "biannual",
  squareFeet: number,
  options: { twoStory?: boolean; includeScreens?: boolean } = {},
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  const frequency: CareFrequency =
    tier === "quarterly" ? "quarterly" : "bi_annual";
  return calculateExteriorPrice(squareFeet, frequency, settings, options);
}

/** @deprecated Use getMinSqft(settings) */
export const MIN_SQFT = DEFAULT_COMPANY_SETTINGS.minimumQuoteSqft;
/** @deprecated Use getMaxSqft(settings) */
export const MAX_SQFT = DEFAULT_COMPANY_SETTINGS.maximumQuoteSqft;
