/**
 * SqueegeeKing membership ladder — Bi-Annual vs Quarterly (sales + presentations).
 * Portal / HomeAtlas estate tiers (Essential · Premium · Elite) remain below for
 * member portal math until fully migrated.
 */

import { visitPriceForMembershipTier } from "@/lib/pricing/window-care-pricing";

export type SqueegeeKingTierId = "biannual" | "quarterly";

export interface SqueegeeKingTierDefinition {
  id: SqueegeeKingTierId;
  label: string;
  tagline: string;
  visitsPerYear: number;
  frequency: string;
  /** Percent off list price on add-on services while payments are active */
  addonDiscount: number;
  benefits: string[];
  exclusions: string[];
  highlighted: boolean;
  premiumBadge?: string;
  /** Default per-visit price before sqft multiplier — override in presentations */
  defaultVisitPrice: number;
  recommendedFor: string;
}

export const RAINBLOCK_RETAIL_VALUE = 95;
export const HARDWATER_RETAIL_VALUE = 75;
export const QUARTERLY_TREATMENT_VALUE_PER_VISIT =
  RAINBLOCK_RETAIL_VALUE + HARDWATER_RETAIL_VALUE;
export const QUARTERLY_INCLUDED_TREATMENT_ANNUAL =
  QUARTERLY_TREATMENT_VALUE_PER_VISIT * 4;

/** Example add-ons for presentation savings math (screen + interior per visit). */
export const EXAMPLE_ADDON_SCREEN_CLEANING = 120;
export const EXAMPLE_ADDON_INTERIOR_WINDOWS = 150;

export const ADDON_DISCOUNT_FINE_PRINT = `ADD-ON SERVICE DISCOUNT

Member discount on additional services is applied automatically at time of service and remains valid for the duration of active membership.

  Quarterly Members:   25% off all add-on services
  Bi-Annual Members:   20% off all add-on services

Discount is contingent upon membership payments remaining current. Discount will be suspended immediately upon any lapsed or failed payment and reinstated upon payment resolution. Discount is non-transferable and applies to SqueegeeKing standard service menu only.`;

export const SQUEEGEEKING_TIERS: Record<
  SqueegeeKingTierId,
  SqueegeeKingTierDefinition
> = {
  biannual: {
    id: "biannual",
    label: "Bi-Annual",
    tagline: "Consistent Care",
    visitsPerYear: 2,
    frequency: "Every 6 months",
    addonDiscount: 20,
    benefits: [
      "Exterior window cleaning (2× per year)",
      "Personalized Home Care Plan",
      "VIP Priority Scheduling",
      "Locked member pricing",
      "20% OFF all add-on services (while payments active)",
      "Property Health Monitoring",
      "Automatic service reminders",
      "7-Day Workmanship Guarantee",
    ],
    exclusions: [
      "RainBlock Technology",
      "Hard Water Stain Removal",
      "25% add-on discount (Quarterly exclusive)",
    ],
    highlighted: false,
    defaultVisitPrice: 320,
    recommendedFor: "Occasional refresh",
  },
  quarterly: {
    id: "quarterly",
    label: "Quarterly",
    tagline: "Total Protection",
    visitsPerYear: 4,
    frequency: "Every 3 months",
    addonDiscount: 25,
    benefits: [
      "Exterior window cleaning (4× per year)",
      "Personalized Home Care Plan",
      "VIP Priority Scheduling",
      "Locked member pricing",
      "25% OFF all add-on services (while payments active)",
      "Complimentary RainBlock Technology (every visit)",
      "Complimentary Hard Water Stain Removal (every visit)",
      "Property Health Monitoring",
      "Automatic service reminders",
      "7-Day Workmanship Guarantee",
    ],
    exclusions: [],
    highlighted: true,
    premiumBadge: "White-Glove",
    defaultVisitPrice: 249,
    recommendedFor: "Year-round protection",
  },
};

export const TIER_COMPARISON_ROWS: Array<{
  label: string;
  biannual: string;
  quarterly: string;
}> = [
  { label: "Window cleaning visits / year", biannual: "2", quarterly: "4" },
  { label: "Personalized Home Care Plan", biannual: "✓", quarterly: "✓" },
  { label: "VIP Priority Scheduling", biannual: "✓", quarterly: "✓" },
  { label: "Locked Member Pricing", biannual: "✓", quarterly: "✓" },
  { label: "Discount on Add-On Services", biannual: "20% OFF", quarterly: "25% OFF" },
  { label: "Property Health Monitoring", biannual: "✓", quarterly: "✓" },
  { label: "Automatic Reminders", biannual: "✓", quarterly: "✓" },
  { label: "7-Day Workmanship Guarantee", biannual: "✓", quarterly: "✓" },
  { label: "RainBlock Technology", biannual: "—", quarterly: "✓" },
  { label: "Hard Water Stain Removal", biannual: "—", quarterly: "✓" },
  { label: "Included Treatment Value", biannual: "$0", quarterly: "$140–210" },
  { label: "Recommended For", biannual: "Occasional refresh", quarterly: "Year-round protection" },
];

export const SQUEEGEEKING_TIER_ORDER: SqueegeeKingTierId[] = [
  "quarterly",
  "biannual",
];

export interface SqueegeeKingTierQuote {
  id: SqueegeeKingTierId;
  label: string;
  tagline: string;
  frequency: string;
  rainblockIncluded: boolean;
  hardWaterIncluded: boolean;
  addonDiscount: number;
  visitPrice: number;
  periodPriceLabel: string;
  highlighted: boolean;
}

export function formatTierPeriodPrice(
  price: number,
  tier: SqueegeeKingTierId,
): string {
  const suffix = tier === "quarterly" ? "/quarter" : " bi-annually";
  return `${formatTierPrice(price)}${suffix}`;
}

export function buildSqueegeeKingTierQuote(
  tier: SqueegeeKingTierId,
  squareFootage = 2500,
): SqueegeeKingTierQuote {
  const def = SQUEEGEEKING_TIERS[tier];
  const visitPrice = calculateVisitPrice(tier, squareFootage);
  const periodPriceLabel = formatTierPeriodPrice(visitPrice, tier);

  return {
    id: tier,
    label: def.label,
    tagline: def.tagline,
    frequency: def.frequency,
    rainblockIncluded: tier === "quarterly",
    hardWaterIncluded: tier === "quarterly",
    addonDiscount: def.addonDiscount,
    visitPrice,
    periodPriceLabel,
    highlighted: def.highlighted,
  };
}

export function buildSqueegeeKingTierQuotes(
  squareFootage = 2500,
): SqueegeeKingTierQuote[] {
  return SQUEEGEEKING_TIER_ORDER.map((tier) =>
    buildSqueegeeKingTierQuote(tier, squareFootage),
  );
}

export function membershipRequestHref(
  tier: SqueegeeKingTierId,
  squareFootage?: number,
): string {
  const params = new URLSearchParams({ membership: tier });
  if (squareFootage && squareFootage > 0) {
    params.set("sqft", String(Math.round(squareFootage)));
  }
  return `/request?${params.toString()}`;
}

export function normalizeToSqueegeeKingTier(tier: string): SqueegeeKingTierId {
  const n = tier.toLowerCase();
  if (
    n === "biannual" ||
    n === "bi-annual" ||
    n === "bi_annual" ||
    n === "essential" ||
    n === "one-time" ||
    n.includes("bi-annual") ||
    n.includes("biannual") ||
    n.includes("bi annual")
  ) {
    return "biannual";
  }
  if (n.includes("quarter")) {
    return "quarterly";
  }
  return "quarterly";
}

export function squeegeeKingTierLabel(tier: SqueegeeKingTierId): string {
  return SQUEEGEEKING_TIERS[tier].label;
}

export function calculateVisitPrice(
  tier: SqueegeeKingTierId,
  squareFootage = 2500,
  options: { twoStory?: boolean; includeScreens?: boolean } = {},
): number {
  return visitPriceForMembershipTier(tier, squareFootage, options);
}

export function calculateAnnualFromVisits(
  tier: SqueegeeKingTierId,
  visitPrice: number,
): number {
  return visitPrice * SQUEEGEEKING_TIERS[tier].visitsPerYear;
}

/** Premium on member visit price when comparing to one-time cleaning (sales law). */
export const BIANNUAL_VS_ONETIME_PREMIUM = 100;
export const QUARTERLY_VS_ONETIME_PREMIUM = 150;

export function memberVsOneTimePremium(tier: SqueegeeKingTierId): number {
  return tier === "quarterly"
    ? QUARTERLY_VS_ONETIME_PREMIUM
    : BIANNUAL_VS_ONETIME_PREMIUM;
}

export function oneTimeRetailPerVisit(
  memberVisitPrice: number,
  tier: SqueegeeKingTierId,
): number {
  return memberVisitPrice + memberVsOneTimePremium(tier);
}

/** Annual window-care savings vs buying the same visits at one-time rates. */
export function memberYearlyWindowSavings(
  memberVisitPrice: number,
  tier: SqueegeeKingTierId,
): number {
  const visits = SQUEEGEEKING_TIERS[tier].visitsPerYear;
  const retailAnnual =
    oneTimeRetailPerVisit(memberVisitPrice, tier) * visits;
  const memberAnnual = calculateAnnualFromVisits(tier, memberVisitPrice);
  return retailAnnual - memberAnnual;
}

export function quarterlyUpgradeMath(
  biannualVisitPrice: number,
  quarterlyVisitPrice: number,
) {
  const biannualAnnual = calculateAnnualFromVisits("biannual", biannualVisitPrice);
  const quarterlyAnnual = calculateAnnualFromVisits("quarterly", quarterlyVisitPrice);
  const upgradeCost = quarterlyAnnual - biannualAnnual;
  const rainblockAnnual = RAINBLOCK_RETAIL_VALUE * 4;
  const hardWaterAnnual = HARDWATER_RETAIL_VALUE * 4;
  const includedTreatmentValue = QUARTERLY_INCLUDED_TREATMENT_ANNUAL;
  const netAdvantage = includedTreatmentValue - upgradeCost;

  return {
    biannualAnnual,
    quarterlyAnnual,
    upgradeCost,
    rainblockAnnual,
    hardWaterAnnual,
    includedTreatmentValue,
    netAdvantage,
  };
}

export function formatAddonDiscount(tier: SqueegeeKingTierId): string {
  return `${SQUEEGEEKING_TIERS[tier].addonDiscount}% OFF`;
}

/** Canonical add-on discount percent for HQ recording and portal display. */
export function addonDiscountPercentForTier(
  tier: SqueegeeKingTierId | "unknown",
): number {
  if (tier === "unknown") return SQUEEGEEKING_TIERS.biannual.addonDiscount;
  return SQUEEGEEKING_TIERS[tier].addonDiscount;
}

export function addonSavingsExample() {
  const perVisit =
    EXAMPLE_ADDON_SCREEN_CLEANING + EXAMPLE_ADDON_INTERIOR_WINDOWS;
  const biannualVisits = SQUEEGEEKING_TIERS.biannual.visitsPerYear;
  const quarterlyVisits = SQUEEGEEKING_TIERS.quarterly.visitsPerYear;
  const biannualAddonTotal = perVisit * biannualVisits;
  const quarterlyAddonTotal = perVisit * quarterlyVisits;
  const biannualDiscount = SQUEEGEEKING_TIERS.biannual.addonDiscount;
  const quarterlyDiscount = SQUEEGEEKING_TIERS.quarterly.addonDiscount;

  return {
    screenCleaning: EXAMPLE_ADDON_SCREEN_CLEANING,
    interiorWindows: EXAMPLE_ADDON_INTERIOR_WINDOWS,
    perVisit,
    biannualVisits,
    quarterlyVisits,
    biannualAddonTotal,
    quarterlyAddonTotal,
    biannualSavings: Math.round(biannualAddonTotal * (biannualDiscount / 100)),
    quarterlySavingsAtBiannualVisits: Math.round(
      biannualAddonTotal * (quarterlyDiscount / 100),
    ),
    quarterlySavings: Math.round(quarterlyAddonTotal * (quarterlyDiscount / 100)),
  };
}

export function planNameForAgreement(tier: SqueegeeKingTierId): string {
  const def = SQUEEGEEKING_TIERS[tier];
  return `SqueegeeKing ${def.label} Home Care Membership`;
}

export function agreementTemplateFilename(tier: SqueegeeKingTierId): string {
  return `squeegeeking-${tier}-agreement.pdf`;
}

// ---------------------------------------------------------------------------
// HomeAtlas portal tiers (Essential · Premium · Elite) — legacy / portal
// ---------------------------------------------------------------------------

export type MembershipTierId = "essential" | "premium" | "elite";

export type ServiceFrequency =
  | "quarterly"
  | "bi_annual"
  | "annual"
  | "every_visit"
  | "addon";

export type ServiceScheduleStatus = "completed" | "scheduled" | "pending";

export interface TierServiceDefinition {
  id: string;
  name: string;
  shortLabel: string;
  frequency: ServiceFrequency;
  visitsPerYear: number;
  retailPerVisit: number;
  includedIn: MembershipTierId[];
  addonPrice?: number;
}

export interface MembershipTierDefinition {
  id: MembershipTierId;
  name: string;
  tagline: string;
  basePriceMonthly: number;
  sqftBand: string;
  priorityBooking: boolean;
  dedicatedTech: boolean;
  homeReportCard: boolean;
  pitchLead: "value" | "certainty";
  /** Maps to SqueegeeKing sales tier for presentations */
  salesTier: SqueegeeKingTierId;
}

export const MEMBERSHIP_TIERS: Record<MembershipTierId, MembershipTierDefinition> = {
  essential: {
    id: "essential",
    name: "Essential",
    tagline: "Core exterior care on a predictable rhythm.",
    basePriceMonthly: 89,
    sqftBand: "Any size",
    priorityBooking: false,
    dedicatedTech: false,
    homeReportCard: false,
    pitchLead: "value",
    salesTier: "biannual",
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Quarterly stewardship for homes under 3,000 sq ft.",
    basePriceMonthly: 159,
    sqftBand: "Under 3,000 sq ft",
    priorityBooking: true,
    dedicatedTech: false,
    homeReportCard: true,
    pitchLead: "certainty",
    salesTier: "quarterly",
  },
  elite: {
    id: "elite",
    name: "Elite",
    tagline: "Full property stewardship for larger estates.",
    basePriceMonthly: 249,
    sqftBand: "3,000+ sq ft",
    priorityBooking: true,
    dedicatedTech: true,
    homeReportCard: true,
    pitchLead: "certainty",
    salesTier: "quarterly",
  },
};

export const TIER_SERVICE_CATALOG: TierServiceDefinition[] = [
  {
    id: "exterior-windows",
    name: "Exterior Window Cleaning",
    shortLabel: "Exterior windows",
    frequency: "quarterly",
    visitsPerYear: 4,
    retailPerVisit: 120,
    includedIn: ["premium", "elite"],
  },
  {
    id: "exterior-windows-semi",
    name: "Exterior Window Cleaning",
    shortLabel: "Exterior windows",
    frequency: "bi_annual",
    visitsPerYear: 2,
    retailPerVisit: 120,
    includedIn: ["essential"],
  },
  {
    id: "rainblock",
    name: "RainBlock Technology",
    shortLabel: "RainBlock",
    frequency: "every_visit",
    visitsPerYear: 4,
    retailPerVisit: RAINBLOCK_RETAIL_VALUE,
    includedIn: ["premium", "elite"],
  },
  {
    id: "hard-water",
    name: "Hard Water Stain Removal",
    shortLabel: "Hard water",
    frequency: "every_visit",
    visitsPerYear: 4,
    retailPerVisit: HARDWATER_RETAIL_VALUE,
    includedIn: ["premium", "elite"],
  },
  {
    id: "pressure-wash",
    name: "Exterior Pressure Wash",
    shortLabel: "Pressure wash",
    frequency: "annual",
    visitsPerYear: 1,
    retailPerVisit: 350,
    includedIn: ["premium"],
  },
  {
    id: "gutters",
    name: "Gutter Clean",
    shortLabel: "Gutter clean",
    frequency: "annual",
    visitsPerYear: 1,
    retailPerVisit: 175,
    includedIn: ["essential", "premium"],
  },
];

const BASE_PRICES: Record<MembershipTierId, number> = {
  essential: 89,
  premium: 159,
  elite: 249,
};

export function getSqftPriceMultiplier(squareFootage: number): number {
  if (squareFootage <= 1500) return 0.85;
  if (squareFootage <= 2500) return 1.0;
  if (squareFootage <= 3500) return 1.2;
  if (squareFootage <= 5000) return 1.45;
  return 1.75;
}

export function calculateMembershipPrice(
  tier: MembershipTierId,
  squareFootage: number,
): number {
  const base = BASE_PRICES[tier];
  const multiplier = getSqftPriceMultiplier(squareFootage);
  return Math.round(base * multiplier);
}

export function servicesForTier(tier: MembershipTierId): TierServiceDefinition[] {
  return TIER_SERVICE_CATALOG.filter((s) => s.includedIn.includes(tier));
}

export function servicesForSqueegeeKingTier(
  tier: SqueegeeKingTierId,
): string[] {
  return SQUEEGEEKING_TIERS[tier].benefits;
}

export function calculateTierRetailAnnual(tier: MembershipTierId): number {
  return servicesForTier(tier).reduce(
    (sum, s) => sum + s.retailPerVisit * s.visitsPerYear,
    0,
  );
}

export function calculateMemberAnnual(monthlyPrice: number): number {
  return monthlyPrice * 12;
}

export interface MembershipValueSummary {
  tier: MembershipTierId;
  monthlyPrice: number;
  memberAnnual: number;
  retailAnnual: number;
  annualDelta: number;
  narrative: "savings" | "certainty";
  certaintyCopy: string;
}

export function summarizeMembershipValue(
  tier: MembershipTierId,
  squareFootage: number,
): MembershipValueSummary {
  const monthlyPrice = calculateMembershipPrice(tier, squareFootage);
  const memberAnnual = calculateMemberAnnual(monthlyPrice);
  const retailAnnual = calculateTierRetailAnnual(tier);
  const annualDelta = retailAnnual - memberAnnual;
  const tierDef = MEMBERSHIP_TIERS[tier];

  return {
    tier,
    monthlyPrice,
    memberAnnual,
    retailAnnual,
    annualDelta,
    narrative:
      annualDelta >= 0
        ? "savings"
        : tierDef.pitchLead === "certainty"
          ? "certainty"
          : "savings",
    certaintyCopy:
      "You're not buying visits — you're buying certainty. Your home is maintained on a schedule, by a team that knows it, before problems become expensive.",
  };
}

export function inferMembershipTierId(planNameOrId: string): MembershipTierId {
  const n = planNameOrId.toLowerCase();
  if (n.includes("essential") || n.includes("one-time")) return "essential";
  if (n.includes("elite") || n.includes("estate")) return "elite";
  if (
    n.includes("bi-annual") ||
    n.includes("biannual") ||
    n.includes("bi annual")
  ) {
    return "essential";
  }
  if (n.includes("premium") || n.includes("preferred") || n.includes("quarter")) {
    return "premium";
  }
  return "premium";
}

export function inferSqueegeeKingTierId(planNameOrId: string): SqueegeeKingTierId {
  return MEMBERSHIP_TIERS[inferMembershipTierId(planNameOrId)].salesTier;
}

export function formatTierPrice(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
