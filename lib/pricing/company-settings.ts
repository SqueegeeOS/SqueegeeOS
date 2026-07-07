/**
 * Atlas Pricing Engine — company law (defaults).
 * Runtime values load from Supabase / local cache via PricingSettingsProvider.
 */

export interface ExteriorAddOnSettings {
  softWash: {
    /** Typical flat quote for standard-sized homes */
    defaultPrice: number;
    minPrice: number;
    maxPrice: number;
    /** Above this home sq ft, price scales per additional 1,000 sq ft */
    largeHomeSqftThreshold: number;
    largeHomePer1000Sqft: number;
  };
  /** Affected moss areas only — not whole-home sq ft */
  mossRemoval: {
    ratePerSqft: number;
  };
  pressureWashConcrete: {
    ratePerSqft: number;
  };
  /** Member discount on add-on list price while membership is active */
  memberAddOnDiscount: {
    quarterly: number;
    bi_annual: number;
  };
  /** Rescreening — per-screen price by quantity tier */
  screenRescreening: {
    /** 1–2 screens */
    singleScreenPrice: number;
    /** 3–5 screens */
    midTierMinCount: number;
    midTierMaxCount: number;
    midTierPricePerScreen: number;
    /** 6+ screens */
    bulkMinCount: number;
    bulkPricePerScreen: number;
  };
}

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
  /** Flat add-on when screen cleaning is included on a window visit. */
  screenCleaningAddOn: number;
  /** Flat surcharge for two-story homes (exterior window care). */
  twoStorySurcharge: number;
  exteriorAddOns: ExteriorAddOnSettings;
}

const DEFAULT_EXTERIOR_ADD_ONS: ExteriorAddOnSettings = {
  softWash: {
    defaultPrice: 250,
    minPrice: 200,
    maxPrice: 300,
    largeHomeSqftThreshold: 5500,
    largeHomePer1000Sqft: 40,
  },
  mossRemoval: {
    ratePerSqft: 0.6,
  },
  pressureWashConcrete: {
    ratePerSqft: 0.3,
  },
  memberAddOnDiscount: {
    quarterly: 25,
    bi_annual: 20,
  },
  screenRescreening: {
    singleScreenPrice: 40,
    midTierMinCount: 3,
    midTierMaxCount: 5,
    midTierPricePerScreen: 30,
    bulkMinCount: 6,
    bulkPricePerScreen: 25,
  },
};

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
  oneTimePremium: 100,
  screenCleaningAddOn: 50,
  twoStorySurcharge: 100,
  exteriorAddOns: DEFAULT_EXTERIOR_ADD_ONS,
};

/** @deprecated Use DEFAULT_COMPANY_SETTINGS or useCompanySettings() */
export const COMPANY_SETTINGS = DEFAULT_COMPANY_SETTINGS;

function clampAddonRate(value: number): number {
  return Math.min(5, Math.max(0.01, Math.round(value * 100) / 100));
}

function normalizeExteriorAddOns(
  input?: Partial<ExteriorAddOnSettings> | null,
): ExteriorAddOnSettings {
  const base = DEFAULT_EXTERIOR_ADD_ONS;
  return {
    softWash: {
      defaultPrice: clampInt(
        input?.softWash?.defaultPrice ?? base.softWash.defaultPrice,
        50,
        5000,
      ),
      minPrice: clampInt(
        input?.softWash?.minPrice ?? base.softWash.minPrice,
        50,
        5000,
      ),
      maxPrice: clampInt(
        input?.softWash?.maxPrice ?? base.softWash.maxPrice,
        50,
        10000,
      ),
      largeHomeSqftThreshold: clampInt(
        input?.softWash?.largeHomeSqftThreshold ??
          base.softWash.largeHomeSqftThreshold,
        2000,
        50000,
      ),
      largeHomePer1000Sqft: clampInt(
        input?.softWash?.largeHomePer1000Sqft ??
          base.softWash.largeHomePer1000Sqft,
        0,
        500,
      ),
    },
    mossRemoval: {
      ratePerSqft: clampAddonRate(
        input?.mossRemoval?.ratePerSqft ?? base.mossRemoval.ratePerSqft,
      ),
    },
    pressureWashConcrete: {
      ratePerSqft: clampAddonRate(
        input?.pressureWashConcrete?.ratePerSqft ??
          base.pressureWashConcrete.ratePerSqft,
      ),
    },
    memberAddOnDiscount: {
      quarterly: clampInt(
        input?.memberAddOnDiscount?.quarterly ??
          base.memberAddOnDiscount.quarterly,
        0,
        50,
      ),
      bi_annual: clampInt(
        input?.memberAddOnDiscount?.bi_annual ??
          base.memberAddOnDiscount.bi_annual,
        0,
        50,
      ),
    },
    screenRescreening: {
      singleScreenPrice: clampInt(
        input?.screenRescreening?.singleScreenPrice ??
          base.screenRescreening.singleScreenPrice,
        1,
        500,
      ),
      midTierMinCount: clampInt(
        input?.screenRescreening?.midTierMinCount ??
          base.screenRescreening.midTierMinCount,
        2,
        20,
      ),
      midTierMaxCount: clampInt(
        input?.screenRescreening?.midTierMaxCount ??
          base.screenRescreening.midTierMaxCount,
        3,
        30,
      ),
      midTierPricePerScreen: clampInt(
        input?.screenRescreening?.midTierPricePerScreen ??
          base.screenRescreening.midTierPricePerScreen,
        1,
        500,
      ),
      bulkMinCount: clampInt(
        input?.screenRescreening?.bulkMinCount ??
          base.screenRescreening.bulkMinCount,
        4,
        50,
      ),
      bulkPricePerScreen: clampInt(
        input?.screenRescreening?.bulkPricePerScreen ??
          base.screenRescreening.bulkPricePerScreen,
        1,
        500,
      ),
    },
  };
}

export function normalizeCompanySettings(
  input?: Partial<CompanySettings> | null,
): CompanySettings {
  const base = DEFAULT_COMPANY_SETTINGS;
  if (!input) {
    return {
      ...base,
      rates: {
        quarterly: { ...base.rates.quarterly },
        bi_annual: { ...base.rates.bi_annual },
      },
      exteriorAddOns: normalizeExteriorAddOns(base.exteriorAddOns),
    };
  }

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
    screenCleaningAddOn: clampInt(
      input.screenCleaningAddOn ?? base.screenCleaningAddOn,
      0,
      5000,
    ),
    twoStorySurcharge: clampInt(
      input.twoStorySurcharge ?? base.twoStorySurcharge,
      0,
      5000,
    ),
    exteriorAddOns: normalizeExteriorAddOns(input.exteriorAddOns),
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
  if (settings.exteriorAddOns.softWash.minPrice > settings.exteriorAddOns.softWash.maxPrice) {
    return "Soft wash minimum price must be less than or equal to maximum.";
  }
  if (
    settings.exteriorAddOns.softWash.defaultPrice <
      settings.exteriorAddOns.softWash.minPrice ||
    settings.exteriorAddOns.softWash.defaultPrice >
      settings.exteriorAddOns.softWash.maxPrice
  ) {
    return "Soft wash default price must fall between minimum and maximum.";
  }
  return null;
}

export function settingsFromPerThousandSqft(perThousand: number): number {
  return perThousand / 1000;
}

export function perThousandFromRate(ratePerSqft: number): number {
  return Math.round(ratePerSqft * 1000);
}
