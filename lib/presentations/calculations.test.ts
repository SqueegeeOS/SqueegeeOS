import { describe, expect, it } from "vitest";
import { calculateVisitPrice } from "@/lib/membership/tier-config";
import { buildMembershipPricingFields } from "@/lib/membership/complete-sign-onboarding";
import {
  computePresentationRates,
  hasManualVisitRateOverride,
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
    twoStory: false,
    includeScreens: false,
  };

  it("displays override $300 instead of computed pricing", () => {
    const computed = calculateVisitPrice("quarterly", SQFT);
    expect(computed).not.toBe(300);

    const rates = computePresentationRates({ ...base, monthlyRate: 300 });
    expect(rates.visitRate).toBe(300);
    expect(rates.quarterlyVisit).toBe(300);
    expect(rates.monthlyRate).toBe(300);
    expect(rates.annualRate).toBe(300 * 4);
  });

  it("ignores computed rate when override exists", () => {
    const withoutOverride = computePresentationRates({ ...base, monthlyRate: 0 });
    const withOverride = computePresentationRates({ ...base, monthlyRate: 300 });

    expect(withoutOverride.visitRate).toBe(withoutOverride.quarterlyVisit);
    expect(withOverride.visitRate).toBe(300);
    expect(withOverride.visitRate).not.toBe(withoutOverride.visitRate);
  });

  it("applies override to the presentation tier column only", () => {
    const biannualRates = computePresentationRates({
      ...base,
      tier: "biannual",
      monthlyRate: 300,
    });
    expect(biannualRates.biannualVisit).toBe(300);
    expect(biannualRates.quarterlyVisit).toBe(
      calculateVisitPrice("quarterly", SQFT),
    );
  });

  it("feeds agreement and membership pricing from override", () => {
    const presentation = {
      ...base,
      monthlyRate: 300,
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

  it("preserves override through withComputedRates and tier changes", () => {
    const preserved = withComputedRates({
      tier: "quarterly",
      homeSqft: SQFT,
      monthlyRate: 300,
      retailValue: 0,
      twoStory: false,
      includeScreens: false,
    });
    expect(preserved.monthlyRate).toBe(300);
    expect(preserved.annualRate).toBe(1200);

    const tierSwitched = withComputedRates({
      tier: "biannual",
      homeSqft: SQFT,
      monthlyRate: 300,
      retailValue: 0,
      twoStory: false,
      includeScreens: false,
    });
    expect(tierSwitched.monthlyRate).toBe(300);
    expect(tierSwitched.annualRate).toBe(600);
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

  it("keeps override after sqft or pricing-option recalculation", () => {
    const afterSqftChange = withComputedRates({
      tier: "quarterly",
      homeSqft: 3200,
      monthlyRate: 300,
      retailValue: 0,
      twoStory: true,
      includeScreens: true,
    });
    expect(afterSqftChange.monthlyRate).toBe(300);
    expect(
      computePresentationRates({
        tier: "quarterly",
        homeSqft: 3200,
        monthlyRate: 300,
        twoStory: true,
        includeScreens: true,
      }).quarterlyVisit,
    ).toBe(300);
  });

  it("computes yearly savings from member visit + tier one-time premium", () => {
    const biannual = computePresentationRates({
      tier: "biannual",
      homeSqft: SQFT,
      monthlyRate: 300,
    });
    expect(biannual.yearlyWindowSavings).toBe(200);
    expect(biannual.oneTimePerVisit).toBe(400);
    expect(biannual.biannualYearlyWindowSavings).toBe(200);

    const quarterly = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
      monthlyRate: 300,
    });
    expect(quarterly.yearlyWindowSavings).toBe(600);
    expect(quarterly.oneTimePerVisit).toBe(450);
    expect(quarterly.quarterlyYearlyWindowSavings).toBe(600);
  });
});
