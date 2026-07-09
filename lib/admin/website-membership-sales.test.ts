import { describe, expect, it } from "vitest";
import {
  computeAnnualizedMembershipValue,
  formatPropertyAddress,
  formatWebsiteMembershipSaleTier,
  qualifiesForWebsiteMembershipSale,
} from "./website-membership-sales";

describe("qualifiesForWebsiteMembershipSale", () => {
  it("counts stripe activations", () => {
    expect(qualifiesForWebsiteMembershipSale("stripe")).toBe(true);
  });

  it("skips mock activations by default", () => {
    expect(qualifiesForWebsiteMembershipSale("mock")).toBe(false);
  });
});

describe("computeAnnualizedMembershipValue", () => {
  it("multiplies visit price by visits per year", () => {
    expect(computeAnnualizedMembershipValue(300, 4)).toBe(1200);
    expect(computeAnnualizedMembershipValue(286.5, 2)).toBe(573);
  });
});

describe("formatPropertyAddress", () => {
  it("joins address parts", () => {
    expect(
      formatPropertyAddress({
        address: "123 Main St",
        city: "Phoenix",
        state: "AZ",
        zip: "85001",
      }),
    ).toBe("123 Main St, Phoenix, AZ 85001");
  });
});

describe("formatWebsiteMembershipSaleTier", () => {
  it("formats tier labels", () => {
    expect(formatWebsiteMembershipSaleTier("quarterly")).toBe("Quarterly");
    expect(formatWebsiteMembershipSaleTier("biannual")).toBe("Bi-Annual");
  });
});
