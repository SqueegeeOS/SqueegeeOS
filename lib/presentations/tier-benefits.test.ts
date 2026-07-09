import { describe, expect, it } from "vitest";
import { QUARTERLY_INCLUDED_TREATMENT_ANNUAL } from "@/lib/membership/tier-config";
import { computePresentationRates } from "@/lib/presentations/calculations";
import {
  presentationDifferenceRows,
  presentationIncludedItems,
  tierIncludesPremiumTreatments,
} from "@/lib/presentations/tier-benefits";

describe("presentationIncludedItems", () => {
  it("includes RainBlock and 25% add-ons for Quarterly only", () => {
    const quarterly = presentationIncludedItems("quarterly");
    expect(quarterly.some((item) => item.label.includes("RainBlock"))).toBe(true);
    expect(quarterly.some((item) => item.detail === "25% off add-ons")).toBe(true);

    const biannual = presentationIncludedItems("biannual");
    expect(biannual.some((item) => item.label.includes("RainBlock"))).toBe(false);
    expect(biannual.some((item) => item.detail === "20% off add-ons")).toBe(true);
  });
});

describe("presentationDifferenceRows", () => {
  it("does not claim RainBlock included for Bi-Annual", () => {
    const rows = presentationDifferenceRows("biannual");
    expect(rows.some((row) => row.us.includes("RainBlock"))).toBe(false);
    expect(rows.some((row) => row.us.includes("20% off add-on"))).toBe(true);
  });

  it("keeps RainBlock row for Quarterly", () => {
    const rows = presentationDifferenceRows("quarterly");
    expect(rows.some((row) => row.us.includes("RainBlock"))).toBe(true);
  });
});

describe("computePresentationRates retailValue", () => {
  it("ignores stored retail value on Bi-Annual presentations", () => {
    const rates = computePresentationRates({
      tier: "biannual",
      homeSqft: 2500,
      retailValue: QUARTERLY_INCLUDED_TREATMENT_ANNUAL,
    });
    expect(rates.retailValue).toBe(0);
    expect(rates.certaintyCopy).not.toContain("RainBlock");
  });

  it("defaults Quarterly retail value when unset", () => {
    const rates = computePresentationRates({
      tier: "quarterly",
      homeSqft: 2500,
      retailValue: 0,
    });
    expect(rates.retailValue).toBe(QUARTERLY_INCLUDED_TREATMENT_ANNUAL);
  });
});

describe("tierIncludesPremiumTreatments", () => {
  it("is true only for Quarterly", () => {
    expect(tierIncludesPremiumTreatments("quarterly")).toBe(true);
    expect(tierIncludesPremiumTreatments("biannual")).toBe(false);
  });
});
