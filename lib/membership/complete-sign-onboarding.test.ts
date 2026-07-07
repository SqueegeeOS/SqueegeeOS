import { describe, expect, it } from "vitest";
import { buildMembershipPricingFields } from "./complete-sign-onboarding";

describe("buildMembershipPricingFields", () => {
  it("computes quarterly pricing fields", () => {
    const fields = buildMembershipPricingFields({
      tier: "quarterly",
      visitPrice: 285,
      planName: "Quarterly Membership",
    });

    expect(fields).toMatchObject({
      salesTier: "quarterly",
      visitPrice: 285,
      annualRate: 1140,
      visitsPerYear: 4,
      priceDisplay: "$285/visit",
      billingPeriod: "per_visit",
      planName: "Quarterly Membership",
    });
  });

  it("computes biannual pricing fields", () => {
    const fields = buildMembershipPricingFields({
      tier: "biannual",
      visitPrice: 320,
      planName: "Bi-Annual Membership",
    });

    expect(fields).toMatchObject({
      salesTier: "biannual",
      visitPrice: 320,
      annualRate: 640,
      visitsPerYear: 2,
    });
  });
});
