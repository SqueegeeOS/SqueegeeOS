/**
 * SqueegeeKing base quarterly pricing — exterior only, screens not included.
 * Member quarterly rate = $0.10/sqft per visit (floor pricing while profitable).
 * One-time = member rate + $150. Interior adds 60% to exterior price.
 */

export const QUARTERLY_BASE_RATE_PER_SQFT = 0.1;
export const ONE_TIME_NON_MEMBER_PREMIUM = 150;
export const INTERIOR_ADDON_MULTIPLIER = 1.6;

export const PRICING_PRESET_SQFT = [1400, 1500, 2500] as const;

export interface QuarterlyBaseQuote {
  squareFootage: number;
  /** Quarterly membership — exterior only, no screens */
  quarterlyExterior: number;
  /** Quarterly membership — inside + outside, no screens */
  quarterlyInsideOut: number;
  /** One-time — exterior only */
  oneTimeExterior: number;
  /** One-time — inside + outside */
  oneTimeInsideOut: number;
  quarterlyExteriorAnnual: number;
  quarterlyInsideOutAnnual: number;
  oneTimePremium: number;
  interiorMultiplier: number;
}

export function calculateQuarterlyBaseQuote(
  squareFootage: number,
): QuarterlyBaseQuote {
  const sqft = Math.max(0, Math.round(squareFootage));
  const quarterlyExterior = Math.round(sqft * QUARTERLY_BASE_RATE_PER_SQFT);
  const quarterlyInsideOut = Math.round(
    quarterlyExterior * INTERIOR_ADDON_MULTIPLIER,
  );
  const oneTimeExterior = quarterlyExterior + ONE_TIME_NON_MEMBER_PREMIUM;
  const oneTimeInsideOut = Math.round(
    oneTimeExterior * INTERIOR_ADDON_MULTIPLIER,
  );

  return {
    squareFootage: sqft,
    quarterlyExterior,
    quarterlyInsideOut,
    oneTimeExterior,
    oneTimeInsideOut,
    quarterlyExteriorAnnual: quarterlyExterior * 4,
    quarterlyInsideOutAnnual: quarterlyInsideOut * 4,
    oneTimePremium: ONE_TIME_NON_MEMBER_PREMIUM,
    interiorMultiplier: INTERIOR_ADDON_MULTIPLIER,
  };
}

export function formatPricingAmount(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
