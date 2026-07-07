export type CareFrequency = "quarterly" | "bi_annual";

export type ServiceScope = "exterior_glass" | "interior_exterior_glass";

export interface PricingInput {
  squareFeet: number;
  frequency: CareFrequency;
  includeInterior: boolean;
  /** Optional screen cleaning add-on (flat rate from company settings). */
  includeScreens?: boolean;
  /** Two-story homes add a flat surcharge (company settings). */
  twoStory?: boolean;
}

export interface ExteriorWindowPriceBreakdown {
  /** Sq ft × rate for the selected frequency */
  sqftBase: number;
  twoStorySurcharge: number;
  screenCleaning: number;
  visitTotal: number;
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
  /** Line-item math for the exterior visit (selected frequency). */
  exteriorBreakdown: ExteriorWindowPriceBreakdown;
  /** Line-item math for one-time exterior (always based on bi-annual sq ft rate). */
  oneTimeExteriorBreakdown: ExteriorWindowPriceBreakdown;
  /** Populated when Atlas reasoning is enabled (v2+). */
  recommendation?: PricingRecommendation;
}

export type ExteriorAddOnId =
  | "soft_wash_exterior"
  | "moss_removal"
  | "pressure_wash_concrete"
  | "screen_rescreening";

export interface ExteriorAddOnSelection {
  id: ExteriorAddOnId;
  enabled: boolean;
  /** Treated area sq ft — moss removal & concrete only */
  areaSqft?: number;
  /** Screen count — rescreening only */
  screenCount?: number;
}

export interface ExteriorAddOnLineItem {
  id: ExteriorAddOnId;
  label: string;
  /** Member / quoted price (after discount when applicable) */
  amount: number;
  /** List price before member discount */
  listAmount: number;
  detail: string;
  memberDiscountPercent?: number;
}

export interface ExteriorAddOnQuote {
  lineItems: ExteriorAddOnLineItem[];
  /** Sum of member/quoted prices */
  subtotal: number;
  listSubtotal: number;
  memberDiscountPercent: number | null;
  memberSavings: number;
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
