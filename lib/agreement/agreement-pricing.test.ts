import { describe, expect, it } from "vitest";
import {
  buildAgreementPricingSnapshot,
  includedTreatmentsForTier,
} from "./agreement-pricing";
import {
  HARDWATER_RETAIL_VALUE,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  RAINBLOCK_RETAIL_VALUE,
} from "@/lib/membership/tier-config";

describe("agreement-pricing", () => {
  it("calculates quarterly included value from retail rates x visits", () => {
    const treatments = includedTreatmentsForTier("quarterly");
    expect(treatments).toHaveLength(2);
    expect(treatments[0]?.annualValue).toBe(RAINBLOCK_RETAIL_VALUE * 4);
    expect(treatments[1]?.annualValue).toBe(HARDWATER_RETAIL_VALUE * 4);
    expect(QUARTERLY_INCLUDED_TREATMENT_ANNUAL).toBe(680);
  });

  it("derives bi-annual savings from member visit + $100 premium", () => {
    const sqft = 2500;
    const visitPrice = 300;

    const pricing = buildAgreementPricingSnapshot({
      tier: "biannual",
      visitPrice,
      homeSqft: sqft,
    });

    expect(pricing.kind).toBe("savings");
    if (pricing.kind === "savings") {
      expect(pricing.retailPerVisit).toBe(400);
      expect(pricing.membershipAnnual).toBe(600);
      expect(pricing.retailAnnual).toBe(800);
      expect(pricing.youSave).toBe(200);
      expect(pricing.retailRows[0]?.detail).toBe("$400 × 2 = $800");
      expect(pricing.membershipRow.detail).toBe("$300 × 2 = $600");
    }
  });

  it("uses quote_snapshot visit price when tier matches snapshot frequency", () => {
    const pricing = buildAgreementPricingSnapshot({
      tier: "quarterly",
      quoteSnapshot: {
        sqft: 2500,
        frequency: "quarterly",
        includeInterior: false,
        twoStory: false,
        includeScreens: false,
        windowCareVisitPrice: 249,
        frequencyLabel: "Every 3 Months",
        exteriorAddOnQuote: {
          lineItems: [],
          subtotal: 0,
          listSubtotal: 0,
          memberDiscountPercent: null,
          memberSavings: 0,
        },
        totalEstimate: 249,
      },
    });

    expect(pricing.kind).toBe("included");
    if (pricing.kind === "included") {
      expect(pricing.membershipPerVisit).toBe(249);
      expect(pricing.membershipAnnual).toBe(996);
      expect(pricing.includedAnnualValue).toBe(680);
      expect(pricing.retailAnnual).toBe(1676);
      expect(pricing.source).toBe("quote_snapshot");
    }
  });
});
