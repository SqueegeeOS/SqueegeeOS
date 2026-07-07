import type { CareFrequency, ExteriorAddOnQuote, PricingOutput } from "@/lib/pricing/types";

export interface PresentationQuoteSnapshot {
  sqft: number;
  frequency: CareFrequency;
  includeInterior: boolean;
  twoStory: boolean;
  includeScreens: boolean;
  windowCareVisitPrice: number;
  frequencyLabel: string;
  exteriorAddOnQuote: ExteriorAddOnQuote;
  totalEstimate: number;
}

export function buildPresentationQuoteSnapshot(input: {
  sqft: number;
  frequency: CareFrequency;
  includeInterior: boolean;
  twoStory?: boolean;
  includeScreens?: boolean;
  pricing: PricingOutput;
  addOnQuote: ExteriorAddOnQuote | null;
}): PresentationQuoteSnapshot {
  const windowCareVisitPrice = input.includeInterior
    ? input.pricing.interiorExteriorMemberPrice
    : input.pricing.exteriorMemberPrice;

  const exteriorAddOnQuote = input.addOnQuote ?? {
    lineItems: [],
    subtotal: 0,
    listSubtotal: 0,
    memberDiscountPercent: null,
    memberSavings: 0,
  };

  return {
    sqft: input.sqft,
    frequency: input.frequency,
    includeInterior: input.includeInterior,
    twoStory: input.twoStory ?? false,
    includeScreens: input.includeScreens ?? false,
    windowCareVisitPrice,
    frequencyLabel: input.pricing.frequencyLabel,
    exteriorAddOnQuote,
    totalEstimate: windowCareVisitPrice + exteriorAddOnQuote.subtotal,
  };
}

export function careFrequencyToPresentationTier(
  frequency: CareFrequency,
): "quarterly" | "biannual" {
  return frequency === "quarterly" ? "quarterly" : "biannual";
}
