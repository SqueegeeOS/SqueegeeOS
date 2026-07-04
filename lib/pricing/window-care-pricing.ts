/**
 * Atlas Pricing Engine v1.0
 *
 * Central pricing law for HomeAtlas / SqueegeeKing.
 * North star: trust first, consistency second — not just calculations.
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
export type { CompanySettings } from "./company-settings";

export type {
  CareFrequency,
  CustomerRelationship,
  PricingComparison,
  PricingInput,
  PricingOutput,
  PricingRecommendation,
  PropertyAccessFlags,
  PropertyContext,
  ServiceScope,
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

export function calculateExteriorPrice(
  sqft: number,
  frequency: CareFrequency,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  return Math.round(sqft * settings.rates[frequency].ratePerSqft);
}

export function calculateInteriorExteriorPrice(
  exteriorPrice: number,
  settings: CompanySettings = DEFAULT_COMPANY_SETTINGS,
): number {
  return Math.round(exteriorPrice * settings.interiorMultiplier);
}

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

  const exteriorMemberPrice = calculateExteriorPrice(
    input.squareFeet,
    input.frequency,
    resolved,
  );

  const interiorExteriorMemberPrice = calculateInteriorExteriorPrice(
    exteriorMemberPrice,
    resolved,
  );

  const exteriorOneTimePrice = calculateOneTimePrice(exteriorMemberPrice, resolved);

  const interiorExteriorOneTimePrice = calculateOneTimePrice(
    interiorExteriorMemberPrice,
    resolved,
  );

  const annualExteriorValue = exteriorMemberPrice * rateConfig.annualVisits;
  const annualInteriorExteriorValue =
    interiorExteriorMemberPrice * rateConfig.annualVisits;

  const notes: string[] = [];
  const exclusions: string[] = [
    "Screens are not included in base pricing.",
    "Tracks, frames, and sills are not included.",
    "Hard water restoration beyond package allowance is priced separately.",
    "Heavy debris, oxidation, and construction residue are priced separately.",
  ];

  if (input.includeScreens) {
    notes.push("Screens are priced separately. Ask for a screen add-on quote.");
  }

  if (input.frequency === "quarterly") {
    notes.push(
      "Every 3 Months care qualifies for RainBlock Technology and complimentary hard water treatment where included in package.",
    );
  }

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
    differenceExterior: output.oneTimePremium,
    differenceInteriorExterior: output.oneTimePremium,
    frequencyLabel: output.frequencyLabel,
  };
}

/** @deprecated Use getMinSqft(settings) */
export const MIN_SQFT = DEFAULT_COMPANY_SETTINGS.minimumQuoteSqft;
/** @deprecated Use getMaxSqft(settings) */
export const MAX_SQFT = DEFAULT_COMPANY_SETTINGS.maximumQuoteSqft;
