import { describe, expect, it } from "vitest";
import { calculateVisitPrice } from "@/lib/membership/tier-config";
import { buildMembershipPricingFields } from "@/lib/membership/complete-sign-onboarding";
import {
  applyTierVisitOverride,
  computePresentationRates,
  hasManualVisitRateOverride,
  tierVisitPriceForPresentation,
  visitRateFromPresentation,
  withComputedRates,
} from "@/lib/presentations/calculations";

const SQFT = 2800;

describe("hasManualVisitRateOverride", () => {
  it("treats positive monthlyRate as manual override", () => {
    expect(hasManualVisitRateOverride(300)).toBe(true);
    expect(hasManualVisitRateOverride(0)).toBe(false);
    expect(hasManualVisitRateOverride(undefined)).toBe(false);
  });
});

describe("manual per-visit override precedence", () => {
  const base = {
    tier: "quarterly" as const,
    homeSqft: SQFT,
    monthlyRate: 0,
    twoStory: false,
    includeScreens: false,
  };

  it("displays override $300 instead of computed pricing", () => {
    const computed = calculateVisitPrice("quarterly", SQFT);
    expect(computed).not.toBe(300);

    const rates = computePresentationRates({
      ...base,
      visitRateOverrides: { quarterly: 300 },
    });
    expect(rates.visitRate).toBe(300);
    expect(rates.quarterlyVisit).toBe(300);
    expect(rates.monthlyRate).toBe(300);
    expect(rates.annualRate).toBe(300 * 4);
  });

  it("ignores computed rate when override exists", () => {
    const withoutOverride = computePresentationRates({ ...base, monthlyRate: 0 });
    const withOverride = computePresentationRates({
      ...base,
      visitRateOverrides: { quarterly: 300 },
    });

    expect(withoutOverride.visitRate).toBe(withoutOverride.quarterlyVisit);
    expect(withOverride.visitRate).toBe(300);
    expect(withOverride.visitRate).not.toBe(withoutOverride.visitRate);
  });

  it("scopes bi-annual override to bi-annual only", () => {
    const scoped = computePresentationRates({
      ...base,
      tier: "quarterly",
      visitRateOverrides: { biannual: 300 },
      overrideTier: "biannual",
      monthlyRate: 300,
    });

    expect(scoped.biannualVisit).toBe(300);
    expect(scoped.quarterlyVisit).toBe(calculateVisitPrice("quarterly", SQFT));
    expect(scoped.quarterlyVisit).not.toBe(300);
  });

  it("does not bleed bi-annual override into quarterly signing modal", () => {
    const quarterlySigning = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
      twoStory: false,
      includeScreens: false,
      visitRateOverrides: { biannual: 300 },
      overrideTier: "biannual",
      monthlyRate: 300,
    });

    expect(quarterlySigning.quarterlyVisit).toBe(
      calculateVisitPrice("quarterly", SQFT),
    );
    expect(tierVisitPriceForPresentation(
      {
        tier: "biannual",
        homeSqft: SQFT,
        visitRateOverrides: { biannual: 300 },
        monthlyRate: 300,
        overrideTier: "biannual",
      },
      "quarterly",
    )).not.toBe(300);
  });

  it("feeds agreement and membership pricing from tier-scoped override", () => {
    const presentation = {
      ...base,
      visitRateOverrides: { quarterly: 300 },
    };
    const visitPrice = visitRateFromPresentation(presentation);
    expect(visitPrice).toBe(300);

    const membership = buildMembershipPricingFields({
      tier: "quarterly",
      visitPrice,
      planName: "Quarterly Membership",
    });
    expect(membership.visitPrice).toBe(300);
    expect(membership.priceDisplay).toBe("$300/visit");
  });

  it("preserves per-tier overrides through withComputedRates and tier changes", () => {
    const preserved = withComputedRates({
      tier: "biannual",
      homeSqft: SQFT,
      visitRateOverrides: { biannual: 300 },
      monthlyRate: 300,
      overrideTier: "biannual",
      retailValue: 0,
      twoStory: false,
      includeScreens: false,
    });
    expect(preserved.visitRateOverrides?.biannual).toBe(300);

    const tierSwitched = withComputedRates({
      tier: "quarterly",
      homeSqft: SQFT,
      visitRateOverrides: preserved.visitRateOverrides,
      monthlyRate: 0,
      retailValue: 0,
      twoStory: false,
      includeScreens: false,
    });
    expect(tierSwitched.visitRateOverrides?.biannual).toBe(300);
    expect(tierSwitched.monthlyRate).toBe(0);
    expect(tierSwitched.annualRate).toBe(
      calculateVisitPrice("quarterly", SQFT) * 4,
    );
  });

  it("does not store computed pricing in monthlyRate when no override", () => {
    const normalized = withComputedRates({
      tier: "quarterly",
      homeSqft: SQFT,
      monthlyRate: 0,
      retailValue: 0,
      twoStory: false,
      includeScreens: false,
    });
    expect(normalized.monthlyRate).toBe(0);
    expect(normalized.annualRate).toBe(
      calculateVisitPrice("quarterly", SQFT) * 4,
    );
  });

  it("keeps tier override after sqft or pricing-option recalculation", () => {
    const afterSqftChange = withComputedRates({
      tier: "quarterly",
      homeSqft: 3200,
      visitRateOverrides: { quarterly: 300 },
      retailValue: 0,
      twoStory: true,
      includeScreens: true,
    });
    expect(afterSqftChange.visitRateOverrides?.quarterly).toBe(300);
    expect(
      computePresentationRates({
        tier: "quarterly",
        homeSqft: 3200,
        monthlyRate: 0,
        visitRateOverrides: { quarterly: 300 },
        twoStory: true,
        includeScreens: true,
      }).quarterlyVisit,
    ).toBe(300);
  });

  it("computes yearly savings from member visit + tier one-time premium", () => {
    const biannual = computePresentationRates({
      tier: "biannual",
      homeSqft: SQFT,
      monthlyRate: 0,
      visitRateOverrides: { biannual: 300 },
    });
    expect(biannual.yearlyWindowSavings).toBe(200);
    expect(biannual.oneTimePerVisit).toBe(400);
    expect(biannual.biannualYearlyWindowSavings).toBe(200);

    const quarterly = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
      monthlyRate: 0,
      visitRateOverrides: { quarterly: 300 },
    });
    expect(quarterly.yearlyWindowSavings).toBe(600);
    expect(quarterly.oneTimePerVisit).toBe(450);
    expect(quarterly.quarterlyYearlyWindowSavings).toBe(600);
  });

  it("sets override only on the tier being edited", () => {
    const next = applyTierVisitOverride(
      {
        tier: "biannual",
        visitRateOverrides: {},
        monthlyRate: 0,
      },
      "biannual",
      300,
    );
    expect(next.visitRateOverrides?.biannual).toBe(300);
    expect(next.overrideTier).toBe("biannual");

    const quarterlyOverride = applyTierVisitOverride(
      {
        tier: "quarterly",
        visitRateOverrides: { biannual: 300 },
        monthlyRate: 0,
        overrideTier: null,
      },
      "quarterly",
      249,
    );
    expect(quarterlyOverride.visitRateOverrides?.biannual).toBe(300);
    expect(quarterlyOverride.visitRateOverrides?.quarterly).toBe(249);
  });
});
