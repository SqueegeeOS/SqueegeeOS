/**
 * Atlas Pricing Engine v1.0
 *
 * Central pricing law for HomeAtlas / SqueegeeKing.
 * North star: trust first, consistency second — not just calculations.
 *
 * @see docs/ATLAS_PRICING_ENGINE.md
 */
import {
  COMPANY_SETTINGS,
  MAX_SQFT,
  MIN_SQFT,
} from "./company-settings";
import type {
  CareFrequency,
  PricingComparison,
  PricingInput,
  PricingOutput,
  PricingRecommendation,
} from "./types";

export { COMPANY_SETTINGS, MIN_SQFT, MAX_SQFT } from "./company-settings";
export type { CompanySettings } from "./company-settings";

const FREQUENCY_LABELS: Record<CareFrequency, string> = {
  quarterly: "Every 3 Months",
  bi_annual: "Every 6 Months",
};

export const PRICING_SQFT_PRESETS = [1000, 1400, 1500, 2500, 3000] as const;

export function validateInput(input: PricingInput): string | null {
  if (!input.squareFeet || input.squareFeet <= 0) {
    return "Square footage must be greater than zero.";
  }
  if (input.squareFeet < MIN_SQFT) {
    return `Minimum square footage is ${MIN_SQFT}.`;
  }
  if (input.squareFeet > MAX_SQFT) {
    return `Maximum square footage is ${MAX_SQFT}.`;
  }
  return null;
}

export function calculateExteriorPrice(
  sqft: number,
  frequency: CareFrequency,
): number {
  return Math.round(sqft * COMPANY_SETTINGS.rates[frequency].ratePerSqft);
}

export function calculateInteriorExteriorPrice(exteriorPrice: number): number {
  return Math.round(exteriorPrice * COMPANY_SETTINGS.interiorMultiplier);
}

export function calculateOneTimePrice(memberPrice: number): number {
  return Math.round(memberPrice + COMPANY_SETTINGS.oneTimePremium);
}

/**
 * Atlas Pricing Engine v2 — returns advisory reasoning when property
 * intelligence and recommendation models are connected.
 */
export function buildPricingRecommendation(
  _input: PricingInput,
  _output: Omit<PricingOutput, "recommendation">,
): PricingRecommendation | undefined {
  return undefined;
}

export function calculateWindowCarePricing(input: PricingInput): PricingOutput {
  const rateConfig = COMPANY_SETTINGS.rates[input.frequency];
  const frequencyLabel = FREQUENCY_LABELS[input.frequency];

  const exteriorMemberPrice = calculateExteriorPrice(
    input.squareFeet,
    input.frequency,
  );

  const interiorExteriorMemberPrice =
    calculateInteriorExteriorPrice(exteriorMemberPrice);

  const exteriorOneTimePrice = calculateOneTimePrice(exteriorMemberPrice);

  const interiorExteriorOneTimePrice = calculateOneTimePrice(
    interiorExteriorMemberPrice,
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
    oneTimePremium: COMPANY_SETTINGS.oneTimePremium,
    notes,
    exclusions,
  };

  const recommendation = buildPricingRecommendation(input, base);

  return recommendation ? { ...base, recommendation } : base;
}

export function getPricingComparison(input: PricingInput): PricingComparison {
  const output = calculateWindowCarePricing(input);
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
