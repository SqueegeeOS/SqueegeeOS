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

  it("includes Bill's twice-yearly window addition without changing base pricing", () => {
    const member = {
      annual_rate: 544,
      visit_price: 272,
      visits_per_year: 2,
      recurring_services: [{ status: "active", annual_value_cents: 47600 }],
    };
    expect(computeMembershipYearlyValue(member)).toBe(1020);
    expect(member.visit_price).toBe(272);
    expect(member.annual_rate).toBe(544);
  });

  it("excludes paused and cancelled recurring services", () => {
    expect(computeMembershipYearlyValue({
      annual_rate: 544, visit_price: 272, visits_per_year: 2,
      recurring_services: [
        { status: "paused", annual_value_cents: 47600 },
        { status: "cancelled", annual_value_cents: 63000 },
        { status: "active", annual_value_cents: 8000 },
      ],
    })).toBe(624);
  });

  it("does not present a partial addition as a complete unknown plan value", () => {
    expect(computeMembershipYearlyValue({
      annual_rate: null, visit_price: null, visits_per_year: 2,
      recurring_services: [{ status: "active", annual_value_cents: 47600 }],
    })).toBeNull();
  });

});
