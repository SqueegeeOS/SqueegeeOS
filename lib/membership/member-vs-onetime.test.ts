import { describe, expect, it } from "vitest";
import {
  BIANNUAL_VS_ONETIME_PREMIUM,
  memberYearlyWindowSavings,
  memberVsOneTimePremium,
  oneTimeRetailPerVisit,
  QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
  QUARTERLY_VS_ONETIME_PREMIUM,
} from "@/lib/membership/tier-config";
import { buildAgreementPricingSnapshot } from "@/lib/agreement/agreement-pricing";
import { computePresentationRates } from "@/lib/presentations/calculations";

describe("member vs one-time savings", () => {
  it("uses $100 premium for bi-annual and $150 for quarterly", () => {
    expect(memberVsOneTimePremium("biannual")).toBe(BIANNUAL_VS_ONETIME_PREMIUM);
    expect(memberVsOneTimePremium("quarterly")).toBe(QUARTERLY_VS_ONETIME_PREMIUM);
    expect(BIANNUAL_VS_ONETIME_PREMIUM).toBe(100);
    expect(QUARTERLY_VS_ONETIME_PREMIUM).toBe(150);
  });

  it("derives bi-annual yearly savings as premium × visits", () => {
    expect(oneTimeRetailPerVisit(300, "biannual")).toBe(400);
    expect(memberYearlyWindowSavings(300, "biannual")).toBe(200);
  });

  it("derives quarterly window savings as $150 × 4 visits", () => {
    expect(oneTimeRetailPerVisit(300, "quarterly")).toBe(450);
    expect(memberYearlyWindowSavings(300, "quarterly")).toBe(600);
  });

  it("includes quarterly treatment value in total yearly value", () => {
    const rates = computePresentationRates({
      tier: "quarterly",
      homeSqft: 2800,
      monthlyRate: 0,
      visitRateOverrides: { quarterly: 300 },
    });
    expect(rates.quarterlyYearlyWindowSavings).toBe(600);
    expect(rates.quarterlyYearlyTotalValue).toBe(
      600 + QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
    );
  });

  it("honors manual override in agreement bi-annual savings", () => {
    const pricing = buildAgreementPricingSnapshot({
      tier: "biannual",
      visitPrice: 300,
      homeSqft: 2800,
    });

    expect(pricing.kind).toBe("savings");
    if (pricing.kind === "savings") {
      expect(pricing.retailPerVisit).toBe(400);
      expect(pricing.membershipAnnual).toBe(600);
      expect(pricing.retailAnnual).toBe(800);
      expect(pricing.youSave).toBe(200);
    }
  });
});
