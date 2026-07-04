import { describe, expect, it } from "vitest";
import { COMPANY_SETTINGS } from "./company-settings";
import {
  calculateExteriorPrice,
  calculateInteriorExteriorPrice,
  calculateOneTimePrice,
  calculateWindowCarePricing,
  validateInput,
} from "./window-care-pricing";
import { MAX_SQFT, MIN_SQFT } from "./company-settings";

const { rates, interiorMultiplier, oneTimePremium } = COMPANY_SETTINGS;

describe("Atlas Pricing Engine — window-care-pricing", () => {
  it("derives exterior prices from COMPANY_SETTINGS rates", () => {
    expect(calculateExteriorPrice(1400, "quarterly")).toBe(
      Math.round(1400 * rates.quarterly.ratePerSqft),
    );
    expect(calculateExteriorPrice(2500, "quarterly")).toBe(
      Math.round(2500 * rates.quarterly.ratePerSqft),
    );
    expect(calculateExteriorPrice(1000, "bi_annual")).toBe(
      Math.round(1000 * rates.bi_annual.ratePerSqft),
    );
  });

  it("calculates exterior member prices (canonical examples)", () => {
    expect(calculateExteriorPrice(1400, "quarterly")).toBe(140);
    expect(calculateExteriorPrice(2500, "quarterly")).toBe(250);
    expect(calculateExteriorPrice(1000, "bi_annual")).toBe(125);
  });

  it("calculates interior + exterior member prices", () => {
    expect(calculateInteriorExteriorPrice(150)).toBe(
      Math.round(150 * interiorMultiplier),
    );
    expect(calculateInteriorExteriorPrice(250)).toBe(
      Math.round(250 * interiorMultiplier),
    );
    expect(calculateInteriorExteriorPrice(150)).toBe(240);
    expect(calculateInteriorExteriorPrice(250)).toBe(400);
  });

  it("calculates one-time prices from oneTimePremium", () => {
    expect(calculateOneTimePrice(150)).toBe(150 + oneTimePremium);
    expect(calculateOneTimePrice(240)).toBe(240 + oneTimePremium);
    expect(calculateOneTimePrice(150)).toBe(300);
    expect(calculateOneTimePrice(240)).toBe(390);
  });

  it("calculates full pricing output for exterior scope", () => {
    const output = calculateWindowCarePricing({
      squareFeet: 1500,
      frequency: "quarterly",
      includeInterior: false,
    });
    expect(output.exteriorMemberPrice).toBe(150);
    expect(output.recommendation).toBeUndefined();
  });

  it("calculates full pricing output for interior scope", () => {
    const output = calculateWindowCarePricing({
      squareFeet: 1500,
      frequency: "quarterly",
      includeInterior: true,
    });
    expect(output.interiorExteriorMemberPrice).toBe(240);
  });

  it("enforces minimum square footage", () => {
    expect(
      validateInput({
        squareFeet: MIN_SQFT - 1,
        frequency: "quarterly",
        includeInterior: false,
      }),
    ).toContain(String(MIN_SQFT));
  });

  it("enforces maximum square footage", () => {
    expect(
      validateInput({
        squareFeet: MAX_SQFT + 1,
        frequency: "quarterly",
        includeInterior: false,
      }),
    ).toContain(String(MAX_SQFT));
  });

  it("ignores PropertyContext until v2 reasoning ships", () => {
    const without = calculateWindowCarePricing({
      squareFeet: 2500,
      frequency: "quarterly",
      includeInterior: false,
    });
    const withContext = calculateWindowCarePricing(
      {
        squareFeet: 2500,
        frequency: "quarterly",
        includeInterior: false,
      },
      {
        flags: { secondStoryGlass: true, poolPresent: true },
        customerRelationship: "returning",
      },
    );
    expect(withContext.exteriorMemberPrice).toBe(without.exteriorMemberPrice);
    expect(withContext.recommendation).toBeUndefined();
  });
});
