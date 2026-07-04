export type CareFrequency = "quarterly" | "bi_annual";

export type ServiceScope = "exterior_glass" | "interior_exterior_glass";

export interface PricingInput {
  squareFeet: number;
  frequency: CareFrequency;
  includeInterior: boolean;
  includeScreens?: boolean;
}

/** Atlas Pricing Engine v2 — advisory output (stub until reasoning ships). */
export interface PricingRecommendation {
  frequency: CareFrequency;
  confidence: number;
  reason: string[];
  suggestedUpgrade?: CareFrequency | null;
}

export interface PricingOutput {
  frequencyLabel: string;
  annualVisits: number;
  exteriorMemberPrice: number;
  interiorExteriorMemberPrice: number;
  exteriorOneTimePrice: number;
  interiorExteriorOneTimePrice: number;
  annualExteriorValue: number;
  annualInteriorExteriorValue: number;
  oneTimePremium: number;
  notes: string[];
  exclusions: string[];
  /** Populated when Atlas reasoning is enabled (v2+). */
  recommendation?: PricingRecommendation;
}

export interface PricingComparison {
  recurringExterior: number;
  recurringInteriorExterior: number;
  oneTimeExterior: number;
  oneTimeInteriorExterior: number;
  differenceExterior: number;
  differenceInteriorExterior: number;
  frequencyLabel: string;
}
