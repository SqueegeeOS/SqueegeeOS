/**
 * SqueegeeKing base membership pricing — exterior only, screens not included.
 * One-time = member rate + $150. Interior adds 60% to exterior price.
 */

export type PricingCadence = "quarterly" | "biannual";

export const ONE_TIME_NON_MEMBER_PREMIUM = 150;
export const INTERIOR_ADDON_MULTIPLIER = 1.6;

export const PRICING_CADENCE_CONFIG = {
  quarterly: {
    id: "quarterly" as const,
    label: "Quarterly",
    tagline: "Total Protection",
    ratePerSqft: 0.1,
    visitsPerYear: 4,
    frequency: "Every 3 months",
  },
  biannual: {
    id: "biannual" as const,
    label: "Bi-Annual",
    tagline: "Consistent Care",
    /** $125 at 1,000 sq ft */
    ratePerSqft: 0.125,
    visitsPerYear: 2,
    frequency: "Every 6 months",
  },
} satisfies Record<
  PricingCadence,
  {
    id: PricingCadence;
    label: string;
    tagline: string;
    ratePerSqft: number;
    visitsPerYear: number;
    frequency: string;
  }
>;

export const PRICING_PRESET_SQFT = [1000, 1400, 1500, 2500] as const;

export interface MembershipPricingQuote {
  cadence: PricingCadence;
  squareFootage: number;
  memberExterior: number;
  memberInsideOut: number;
  oneTimeExterior: number;
  oneTimeInsideOut: number;
  memberExteriorAnnual: number;
  memberInsideOutAnnual: number;
  visitsPerYear: number;
  ratePerSqft: number;
  oneTimePremium: number;
  interiorMultiplier: number;
}

export function calculateMembershipPricingQuote(
  squareFootage: number,
  cadence: PricingCadence = "quarterly",
): MembershipPricingQuote {
  const config = PRICING_CADENCE_CONFIG[cadence];
  const sqft = Math.max(0, Math.round(squareFootage));
  const memberExterior = Math.round(sqft * config.ratePerSqft);
  const memberInsideOut = Math.round(memberExterior * INTERIOR_ADDON_MULTIPLIER);
  const oneTimeExterior = memberExterior + ONE_TIME_NON_MEMBER_PREMIUM;
  const oneTimeInsideOut = Math.round(
    oneTimeExterior * INTERIOR_ADDON_MULTIPLIER,
  );

  return {
    cadence,
    squareFootage: sqft,
    memberExterior,
    memberInsideOut,
    oneTimeExterior,
    oneTimeInsideOut,
    memberExteriorAnnual: memberExterior * config.visitsPerYear,
    memberInsideOutAnnual: memberInsideOut * config.visitsPerYear,
    visitsPerYear: config.visitsPerYear,
    ratePerSqft: config.ratePerSqft,
    oneTimePremium: ONE_TIME_NON_MEMBER_PREMIUM,
    interiorMultiplier: INTERIOR_ADDON_MULTIPLIER,
  };
}

export function formatPricingAmount(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function ratePerThousandSqft(ratePerSqft: number): number {
  return Math.round(ratePerSqft * 1000);
}
