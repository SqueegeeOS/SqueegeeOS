export type CareFrequency = "quarterly" | "bi_annual";

export type ServiceScope = "exterior_glass" | "interior_exterior_glass";

export interface PricingInput {
  squareFeet: number;
  frequency: CareFrequency;
  includeInterior: boolean;
  includeScreens?: boolean;
}

/**
 * Atlas Pricing Engine v2+ — optional context from property intelligence,
 * customer history, and regional data. Ignored by v1 math; required shape for v2.
 */
export interface PropertyAccessFlags {
  secondStoryGlass?: boolean;
  poolPresent?: boolean;
  solarPanels?: boolean;
  steepDriveway?: boolean;
  highWindowCount?: boolean;
}

export type CustomerRelationship = "new" | "returning" | "member";

export interface PropertyContext {
  flags?: PropertyAccessFlags;
  customerRelationship?: CustomerRelationship;
  /** Future — market / region when HomeAtlas expands beyond a single territory */
  regionId?: string;
  /** Atlas Property Analyzer — auto-detected sqft before manual override */
  detectedSquareFeet?: number;
  /** Field notes feeding v2 recommendation reasoning */
  observations?: string[];
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
