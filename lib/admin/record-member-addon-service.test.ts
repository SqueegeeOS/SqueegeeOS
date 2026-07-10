import { describe, expect, it } from "vitest";
import {
  computeMemberAddonSavingsCents,
  defaultAddonDiscountForTier,
  validateRecordMemberAddonInput,
} from "./record-member-addon-service";

describe("record-member-addon-service", () => {
  it("defaults tier add-on discounts", () => {
    expect(defaultAddonDiscountForTier("biannual")).toBe(20);
    expect(defaultAddonDiscountForTier("quarterly")).toBe(25);
  });

  it("computes member savings from retail and charged amounts", () => {
    expect(
      computeMemberAddonSavingsCents({
        retailPriceCents: 37500,
        amountChargedCents: 30000,
      }),
    ).toBe(7500);
  });

  it("validates Sylvia moss removal example", () => {
    expect(
      validateRecordMemberAddonInput({
        membershipId: "mem-1",
        serviceName: "Moss Removal + Treatment",
        serviceDate: "2026-07-11",
        retailPrice: 375,
        discountPercent: 20,
        amountCharged: 300,
        status: "paid",
      }),
    ).toBeNull();
  });

  it("rejects charged amount above retail", () => {
    expect(
      validateRecordMemberAddonInput({
        membershipId: "mem-1",
        serviceName: "Gutter cleaning",
        serviceDate: "2026-07-11",
        retailPrice: 300,
        discountPercent: 20,
        amountCharged: 350,
        status: "paid",
      }),
    ).toBeTruthy();
  });
});
