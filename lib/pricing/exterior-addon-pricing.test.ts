import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "./company-settings";
import {
  applyMemberAddOnDiscount,
  applyMemberDiscount,
  calculateExteriorAddOnQuote,
  calculateMossRemovalQuote,
  calculatePressureWashConcreteQuote,
  calculateScreenRescreeningQuote,
  calculateSoftWashQuote,
  getMemberAddOnDiscountPercent,
} from "./exterior-addon-pricing";

describe("exterior add-on pricing", () => {
  it("quotes soft wash flat for standard homes", () => {
    expect(
      calculateSoftWashQuote(2500, DEFAULT_COMPANY_SETTINGS.exteriorAddOns.softWash),
    ).toBe(250);
    expect(
      calculateSoftWashQuote(5500, DEFAULT_COMPANY_SETTINGS.exteriorAddOns.softWash),
    ).toBe(250);
  });

  it("scales soft wash for very large homes", () => {
    expect(
      calculateSoftWashQuote(7500, DEFAULT_COMPANY_SETTINGS.exteriorAddOns.softWash),
    ).toBe(330);
  });

  it("prices moss on affected area only", () => {
    expect(
      calculateMossRemovalQuote(
        500,
        DEFAULT_COMPANY_SETTINGS.exteriorAddOns.mossRemoval,
      ),
    ).toBe(300);
  });

  it("prices concrete pressure wash per sq ft", () => {
    expect(
      calculatePressureWashConcreteQuote(
        1000,
        DEFAULT_COMPANY_SETTINGS.exteriorAddOns.pressureWashConcrete,
      ),
    ).toBe(300);
  });

  it("tiers screen rescreening by quantity", () => {
    const pricing = DEFAULT_COMPANY_SETTINGS.exteriorAddOns.screenRescreening;
    expect(calculateScreenRescreeningQuote(1, pricing)).toEqual({
      perScreen: 40,
      total: 40,
    });
    expect(calculateScreenRescreeningQuote(2, pricing)).toEqual({
      perScreen: 40,
      total: 80,
    });
    expect(calculateScreenRescreeningQuote(4, pricing)).toEqual({
      perScreen: 30,
      total: 120,
    });
    expect(calculateScreenRescreeningQuote(8, pricing)).toEqual({
      perScreen: 25,
      total: 200,
    });
  });

  it("maps membership frequency to add-on discount", () => {
    expect(getMemberAddOnDiscountPercent("quarterly")).toBe(25);
    expect(getMemberAddOnDiscountPercent("bi_annual")).toBe(20);
  });

  it("applies aggregate member discount on subtotal", () => {
    expect(applyMemberDiscount(490, "quarterly")).toEqual({
      discountedTotal: 367.5,
      savings: 122.5,
    });
    expect(applyMemberDiscount(490, "biannual")).toEqual({
      discountedTotal: 392,
      savings: 98,
    });
  });

  it("applies member discount to list prices", () => {
    expect(applyMemberAddOnDiscount(250, 25)).toBe(187.5);
    expect(applyMemberAddOnDiscount(250, 20)).toBe(200);
  });

  it("builds a quote with member pricing", () => {
    const quote = calculateExteriorAddOnQuote(
      2500,
      [
        { id: "soft_wash_exterior", enabled: true },
        { id: "screen_rescreening", enabled: true, screenCount: 4 },
      ],
      DEFAULT_COMPANY_SETTINGS,
      { memberDiscountPercent: 25 },
    );

    expect(quote.listSubtotal).toBe(250 + 120);
    expect(quote.subtotal).toBe(187.5 + 90);
    expect(quote.memberSavings).toBe(92.5);
    expect(quote.lineItems[1]?.amount).toBe(90);
  });

  it("builds a multi-line add-on quote without member discount", () => {
    const quote = calculateExteriorAddOnQuote(
      2500,
      [
        { id: "soft_wash_exterior", enabled: true },
        { id: "moss_removal", enabled: true, areaSqft: 200 },
        { id: "pressure_wash_concrete", enabled: true, areaSqft: 400 },
      ],
      DEFAULT_COMPANY_SETTINGS,
    );

    expect(quote.lineItems).toHaveLength(3);
    expect(quote.subtotal).toBe(250 + 120 + 120);
    expect(quote.memberSavings).toBe(0);
  });
});
