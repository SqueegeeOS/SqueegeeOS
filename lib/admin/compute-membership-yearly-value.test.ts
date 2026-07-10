import { describe, expect, it } from "vitest";
import { computeMembershipYearlyValue } from "./compute-membership-yearly-value";

describe("computeMembershipYearlyValue", () => {
  it("prefers annual_rate when stored", () => {
    expect(
      computeMembershipYearlyValue({
        annual_rate: 650,
        visit_price: 325,
        visits_per_year: 2,
      }),
    ).toBe(650);
  });

  it("calculates bi-annual from visit price", () => {
    expect(
      computeMembershipYearlyValue({
        annual_rate: null,
        visit_price: 325,
        visits_per_year: 2,
      }),
    ).toBe(650);
  });

  it("calculates quarterly from visit price", () => {
    expect(
      computeMembershipYearlyValue({
        annual_rate: null,
        visit_price: 200,
        visits_per_year: 4,
      }),
    ).toBe(800);
  });

  it("returns null when pricing is incomplete", () => {
    expect(
      computeMembershipYearlyValue({
        annual_rate: null,
        visit_price: null,
        visits_per_year: 4,
      }),
    ).toBeNull();
  });
});
