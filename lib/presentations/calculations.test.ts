import { describe, expect, it } from "vitest";
import { calculateVisitPrice } from "@/lib/membership/tier-config";
import { buildMembershipPricingFields } from "@/lib/membership/complete-sign-onboarding";
import { createDefaultCarePlan } from "@/lib/presentations/care-plan";
import {
  applyTierVisitOverride,
  computePresentationRates,
  hasManualVisitRateOverride,
  scopedPresentationSlug,
  tierVisitPriceForPresentation,
  visitRateFromPresentation,
  withComputedRates,
} from "@/lib/presentations/calculations";

const SQFT = 2800;

describe("scopedPresentationSlug", () => {
  it("keeps same-name presentations from sharing a customer identity", () => {
    expect(scopedPresentationSlug("Alex Smith", "pres_12345678", "client")).toBe(
      "alex-smith-12345678",
    );
    expect(scopedPresentationSlug("Alex Smith", "pres_87654321", "client")).toBe(
      "alex-smith-87654321",
    );
  });

  it("is stable and remains within the database slug limit", () => {
    const slug = scopedPresentationSlug(
      "A very long customer name that would otherwise exceed the slug limit",
      "presentation_deadbeef",
      "client",
    );

    expect(slug).toBe(
      scopedPresentationSlug(
        "A very long customer name that would otherwise exceed the slug limit",
        "presentation_deadbeef",
        "client",
      ),
    );
    expect(slug).toHaveLength(48);
    expect(slug.endsWith("-deadbeef")).toBe(true);
  });
});

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

  it("uses an exact annual total for variable custom visits", () => {
    const plan = createDefaultCarePlan({ tier: "quarterly" });
    plan.visits[0] = {
      ...plan.visits[0]!,
      interiorWindows: "included",
    };
    plan.visits[1] = {
      ...plan.visits[1]!,
      screens: "optional",
    };

    const rates = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
      planMode: "custom",
      carePlan: plan,
      twoStory: false,
      includeScreens: false,
      includeInterior: false,
    });
    const exterior = calculateVisitPrice("quarterly", SQFT);

    expect(rates.carePlanPricing?.visits.map((visit) => visit.total)).toEqual([
      exterior + 100,
      exterior,
      exterior,
      exterior,
    ]);
    expect(rates.annualRate).toBe(exterior * 4 + 100);

    const membership = buildMembershipPricingFields({
      tier: "quarterly",
      visitPrice: rates.visitRate,
      annualRate: rates.annualRate,
      variableVisitPricing: true,
      planName: "Personalized Quarterly Membership",
    });
    expect(membership.annualRate).toBe(exterior * 4 + 100);
    expect(membership.priceDisplay).toContain("average/visit");
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
      visitRateOverrides: { biannual: 300 },
    });
    expect(biannual.yearlyWindowSavings).toBe(200);
    expect(biannual.oneTimePerVisit).toBe(400);
    expect(biannual.biannualYearlyWindowSavings).toBe(200);

    const quarterly = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
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
        homeSqft: SQFT,
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
        homeSqft: SQFT,
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

describe("presentation visit options", () => {
  it("adds the standard $100 interior cleaning option to every visit", () => {
    for (const tier of ["biannual", "quarterly"] as const) {
      const exteriorOnly = computePresentationRates({
        tier,
        homeSqft: SQFT,
        includeInterior: false,
      });
      const withInterior = computePresentationRates({
        tier,
        homeSqft: SQFT,
        includeInterior: true,
      });

      expect(withInterior.visitRate - exteriorOnly.visitRate).toBe(100);
      expect(withInterior.annualRate - exteriorOnly.annualRate).toBe(
        tier === "quarterly" ? 400 : 200,
      );
    }
  });

  it("keeps a manual visit override as the final quoted price", () => {
    const rates = computePresentationRates({
      tier: "quarterly",
      homeSqft: SQFT,
      includeInterior: true,
      visitRateOverrides: { quarterly: 425 },
    });

    expect(rates.visitRate).toBe(425);
  });
});
