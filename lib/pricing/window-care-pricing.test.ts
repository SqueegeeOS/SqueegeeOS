import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "./company-settings";
import {
  buildExteriorWindowBreakdown,
  calculateExteriorPrice,
  calculateInteriorExteriorPrice,
  calculateOneTimeExteriorPrice,
  calculateWindowCarePricing,
  getMaxSqft,
  getMinSqft,
  validateInput,
} from "./window-care-pricing";

const { rates, interiorMultiplier, oneTimePremium, screenCleaningAddOn, twoStorySurcharge } =
  DEFAULT_COMPANY_SETTINGS;

const EXAMPLE_SQFT = 2572;

describe("Atlas Pricing Engine — window-care-pricing", () => {
  it("matches Noah's quarterly exterior example (2-story)", () => {
    const breakdown = buildExteriorWindowBreakdown(
      EXAMPLE_SQFT,
      "quarterly",
      { twoStory: true, includeScreens: false },
    );
    expect(breakdown.sqftBase).toBe(257);
    expect(breakdown.twoStorySurcharge).toBe(twoStorySurcharge);
    expect(breakdown.visitTotal).toBe(357);

    const withScreens = buildExteriorWindowBreakdown(
      EXAMPLE_SQFT,
      "quarterly",
      { twoStory: true, includeScreens: true },
    );
    expect(withScreens.visitTotal).toBe(407);
  });

  it("matches Noah's bi-annual exterior example (2-story)", () => {
    const breakdown = buildExteriorWindowBreakdown(
      EXAMPLE_SQFT,
      "bi_annual",
      { twoStory: true, includeScreens: false },
    );
    expect(breakdown.sqftBase).toBe(321);
    expect(breakdown.visitTotal).toBe(421);

    const withScreens = buildExteriorWindowBreakdown(
      EXAMPLE_SQFT,
      "bi_annual",
      { twoStory: true, includeScreens: true },
    );
    expect(withScreens.visitTotal).toBe(471);
  });

  it("matches Noah's one-time exterior example (2-story + screens)", () => {
    expect(
      calculateOneTimeExteriorPrice({
        squareFeet: EXAMPLE_SQFT,
        twoStory: true,
        includeScreens: true,
      }),
    ).toBe(571);
  });

  it("derives exterior prices from COMPANY_SETTINGS rates", () => {
    expect(calculateExteriorPrice(1400, "quarterly")).toBe(
      Math.floor(1400 * rates.quarterly.ratePerSqft),
    );
    expect(calculateExteriorPrice(2500, "quarterly")).toBe(
      Math.floor(2500 * rates.quarterly.ratePerSqft),
    );
    expect(calculateExteriorPrice(1000, "bi_annual")).toBe(
      Math.floor(1000 * rates.bi_annual.ratePerSqft),
    );
  });

  it("calculates exterior member prices (canonical small-home examples)", () => {
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

  it("calculates one-time exterior from bi-annual base + premium", () => {
    expect(
      calculateOneTimeExteriorPrice({
        squareFeet: 1500,
        twoStory: false,
        includeScreens: false,
      }),
    ).toBe(Math.floor(1500 * rates.bi_annual.ratePerSqft) + oneTimePremium);
  });

  it("calculates full pricing output for exterior scope", () => {
    const output = calculateWindowCarePricing({
      squareFeet: 1500,
      frequency: "quarterly",
      includeInterior: false,
    });
    expect(output.exteriorMemberPrice).toBe(150);
    expect(output.recommendation).toBeUndefined();
    expect(output.exteriorBreakdown.sqftBase).toBe(150);
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
    const min = getMinSqft();
    expect(
      validateInput({
        squareFeet: min - 1,
        frequency: "quarterly",
        includeInterior: false,
      }),
    ).toContain(String(min));
  });

  it("enforces maximum square footage", () => {
    const max = getMaxSqft();
    expect(
      validateInput({
        squareFeet: max + 1,
        frequency: "quarterly",
        includeInterior: false,
      }),
    ).toContain(String(max));
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

  it("respects custom settings for one-time premium", () => {
    const custom = {
      ...DEFAULT_COMPANY_SETTINGS,
      oneTimePremium: 225,
    };
    const output = calculateWindowCarePricing(
      {
        squareFeet: 1500,
        frequency: "quarterly",
        includeInterior: false,
      },
      undefined,
      custom,
    );
    expect(output.exteriorOneTimePrice).toBe(
      Math.floor(1500 * custom.rates.bi_annual.ratePerSqft) + 225,
    );
    expect(output.oneTimePremium).toBe(225);
  });
});
