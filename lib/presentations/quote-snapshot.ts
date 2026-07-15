import type {
  CareFrequency,
  ExteriorAddOnQuote,
  ExteriorAddOnSelection,
  PricingOutput,
} from "@/lib/pricing/types";

export const ATLAS_PRESENTATION_PRICING_AUTHORITY =
  "atlas_pricing_engine_v1" as const;

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
  authority?: typeof ATLAS_PRESENTATION_PRICING_AUTHORITY;
  pricingSettingsUpdatedAt?: string | null;
  tierVisitPrices?: { biannual: number; quarterly: number };
  tierEnrollmentSavings?: { biannual: number; quarterly: number };
  exteriorAddOnSelections?: ExteriorAddOnSelection[];
}

export function isAuthoritativePresentationQuoteSnapshot(
  snapshot: PresentationQuoteSnapshot | null | undefined,
): snapshot is PresentationQuoteSnapshot & {
  authority: typeof ATLAS_PRESENTATION_PRICING_AUTHORITY;
  tierVisitPrices: { biannual: number; quarterly: number };
  tierEnrollmentSavings: { biannual: number; quarterly: number };
  exteriorAddOnSelections: ExteriorAddOnSelection[];
} {
  return !!(
    isCarePlanQuoteSnapshot(snapshot) &&
    snapshot.authority === ATLAS_PRESENTATION_PRICING_AUTHORITY &&
    snapshot.tierVisitPrices &&
    snapshot.tierEnrollmentSavings &&
    Number.isFinite(snapshot.tierVisitPrices.biannual) &&
    snapshot.tierVisitPrices.biannual > 0 &&
    Number.isFinite(snapshot.tierVisitPrices.quarterly) &&
    snapshot.tierVisitPrices.quarterly > 0 &&
    Number.isFinite(snapshot.tierEnrollmentSavings.biannual) &&
    snapshot.tierEnrollmentSavings.biannual >= 0 &&
    Number.isFinite(snapshot.tierEnrollmentSavings.quarterly) &&
    snapshot.tierEnrollmentSavings.quarterly >= 0 &&
    Array.isArray(snapshot.exteriorAddOnSelections)
  );
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

/** Care Plan Builder quotes only — not field-prep pricing flags. */
export function isCarePlanQuoteSnapshot(
  snapshot: PresentationQuoteSnapshot | null | undefined,
): snapshot is PresentationQuoteSnapshot {
  return !!(
    snapshot &&
    snapshot.totalEstimate > 0 &&
    snapshot.windowCareVisitPrice > 0 &&
    snapshot.exteriorAddOnQuote
  );
}
