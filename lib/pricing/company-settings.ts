/**
 * Atlas Pricing Engine — company law.
 * All pricing surfaces import from here. No magic numbers in formulas.
 * Future: HQ ⚙ Pricing Settings panel reads/writes this config.
 */
export const COMPANY_SETTINGS = {
  minimumQuoteSqft: 500,
  maximumQuoteSqft: 12000,

  rates: {
    quarterly: {
      ratePerSqft: 0.1,
      annualVisits: 4,
    },
    bi_annual: {
      ratePerSqft: 0.125,
      annualVisits: 2,
    },
  },

  interiorMultiplier: 1.6,
  oneTimePremium: 150,
} as const;

export type CompanySettings = typeof COMPANY_SETTINGS;

export const MIN_SQFT = COMPANY_SETTINGS.minimumQuoteSqft;
export const MAX_SQFT = COMPANY_SETTINGS.maximumQuoteSqft;
