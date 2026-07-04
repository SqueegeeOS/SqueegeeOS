/**
 * Atlas Pricing Engine — company law (defaults).
 * Runtime values load from Supabase / local cache via PricingSettingsProvider.
 */

export interface CompanySettings {
  minimumQuoteSqft: number;
  maximumQuoteSqft: number;
  rates: {
    quarterly: {
      ratePerSqft: number;
      annualVisits: number;
    };
    bi_annual: {
      ratePerSqft: number;
      annualVisits: number;
    };
  };
  interiorMultiplier: number;
  oneTimePremium: number;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
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
};

/** @deprecated Use DEFAULT_COMPANY_SETTINGS or useCompanySettings() */
export const COMPANY_SETTINGS = DEFAULT_COMPANY_SETTINGS;

export function normalizeCompanySettings(
  input?: Partial<CompanySettings> | null,
): CompanySettings {
  const base = DEFAULT_COMPANY_SETTINGS;
  if (!input) return { ...base, rates: { ...base.rates, quarterly: { ...base.rates.quarterly }, bi_annual: { ...base.rates.bi_annual } } };

  return {
    minimumQuoteSqft: clampInt(
      input.minimumQuoteSqft ?? base.minimumQuoteSqft,
      100,
      50000,
    ),
    maximumQuoteSqft: clampInt(
      input.maximumQuoteSqft ?? base.maximumQuoteSqft,
      500,
      100000,
    ),
    rates: {
      quarterly: {
        ratePerSqft: clampRate(
          input.rates?.quarterly?.ratePerSqft ?? base.rates.quarterly.ratePerSqft,
        ),
        annualVisits: clampInt(
          input.rates?.quarterly?.annualVisits ?? base.rates.quarterly.annualVisits,
          1,
          12,
        ),
      },
      bi_annual: {
        ratePerSqft: clampRate(
          input.rates?.bi_annual?.ratePerSqft ?? base.rates.bi_annual.ratePerSqft,
        ),
        annualVisits: clampInt(
          input.rates?.bi_annual?.annualVisits ?? base.rates.bi_annual.annualVisits,
          1,
          12,
        ),
      },
    },
    interiorMultiplier: clampMultiplier(
      input.interiorMultiplier ?? base.interiorMultiplier,
    ),
    oneTimePremium: clampInt(input.oneTimePremium ?? base.oneTimePremium, 0, 5000),
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampRate(value: number): number {
  return Math.min(1, Math.max(0.01, Math.round(value * 1000) / 1000));
}

function clampMultiplier(value: number): number {
  return Math.min(3, Math.max(1, Math.round(value * 100) / 100));
}

export function validateCompanySettings(settings: CompanySettings): string | null {
  if (settings.minimumQuoteSqft >= settings.maximumQuoteSqft) {
    return "Minimum square footage must be less than maximum.";
  }
  if (settings.rates.quarterly.ratePerSqft <= 0 || settings.rates.bi_annual.ratePerSqft <= 0) {
    return "Rates per square foot must be greater than zero.";
  }
  return null;
}

export function settingsFromPerThousandSqft(perThousand: number): number {
  return perThousand / 1000;
}

export function perThousandFromRate(ratePerSqft: number): number {
  return Math.round(ratePerSqft * 1000);
}
