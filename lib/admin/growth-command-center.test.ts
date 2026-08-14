import { describe, expect, it } from "vitest";
import { calculateGrowthScenario, monthsThroughDate } from "./growth-command-center";

describe("growth command center", () => {
  it("calculates the remaining monthly ARR pace without pretending it is actual", () => {
    const scenario = calculateGrowthScenario({
      currentArr: 10_000,
      targetArr: 240_000,
      targetDate: "2028-12-31",
      averageMemberArr: 1_200,
      leadsPerWeek: 10,
      closeRatePercent: 25,
      annualRetentionPercent: 90,
      referenceDate: "2026-08-13",
    });

    expect(scenario.monthsRemaining).toBe(29);
    expect(scenario.arrGap).toBe(230_000);
    expect(scenario.requiredNetArrPerMonth).toBeCloseTo(7_931.03, 1);
    expect(scenario.requiredMembersPerMonth).toBeCloseTo(6.61, 1);
    expect(scenario.projectedArrAtTargetDate).toBeGreaterThan(0);
  });

  it("returns zero months after a deadline and never negative gaps", () => {
    expect(monthsThroughDate("2029-01-01", "2028-12-31")).toBe(0);
    const scenario = calculateGrowthScenario({
      currentArr: 300_000,
      targetArr: 240_000,
      targetDate: "2028-12-31",
      averageMemberArr: 1_000,
      leadsPerWeek: 0,
      closeRatePercent: 0,
      annualRetentionPercent: 100,
      referenceDate: "2028-12-31",
    });
    expect(scenario.arrGap).toBe(0);
  });
});
