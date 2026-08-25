import { describe, expect, it } from "vitest";
import {
  WEEKS_PER_YEAR,
  calculateGrowthScenario,
  monthsThroughDate,
  weeksThroughDate,
} from "./growth-command-center";

describe("growth command center", () => {
  it("retention-adjusts the gross pace required to reach the target", () => {
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

    expect(scenario.monthsRemaining).toBeCloseTo(28.6, 1);
    expect(scenario.arrGap).toBe(230_000);
    expect(scenario.requiredNetArrPerMonth).toBeCloseTo(8_040, -1);
    expect(scenario.requiredGrossArrPerMonth).toBeGreaterThan(
      scenario.requiredNetArrPerMonth,
    );
    expect(scenario.requiredMembersPerMonth).toBeCloseTo(
      scenario.requiredGrossArrPerMonth / 1_200,
      8,
    );
    expect(scenario.projectedArrAtTargetDate).toBeGreaterThan(0);
    expect(scenario.projectedArrAtTargetDate).toBeCloseTo(
      scenario.retainedCurrentArrAtTarget + scenario.retainedNewArrAtTarget,
      8,
    );
  });

  it("uses exact elapsed weeks and preserves the no-churn weekly acquisition identity", () => {
    const scenario = calculateGrowthScenario({
      currentArr: 0,
      targetArr: 52_000,
      targetDate: "2027-01-01T00:00:00.000Z",
      averageMemberArr: 1_000,
      leadsPerWeek: 4,
      closeRatePercent: 25,
      annualRetentionPercent: 100,
      referenceDate: "2026-01-01T00:00:00.000Z",
    });

    expect(scenario.weeksRemaining).toBeCloseTo(365 / 7, 8);
    expect(scenario.modeledGrossArrAdded).toBeCloseTo(
      scenario.weeksRemaining * 1_000,
      8,
    );
    expect(scenario.projectedArrAtTargetDate).toBeCloseTo(
      scenario.modeledGrossArrAdded,
      8,
    );
    expect(scenario.modeledMembersPerMonth).toBeCloseTo(
      WEEKS_PER_YEAR / 12,
      8,
    );
  });

  it("does not claim zero leads are required when close rate is unknown", () => {
    const scenario = calculateGrowthScenario({
      currentArr: 10_000,
      targetArr: 240_000,
      targetDate: "2028-12-31",
      averageMemberArr: 1_200,
      leadsPerWeek: 10,
      closeRatePercent: 0,
      annualRetentionPercent: 90,
      referenceDate: "2026-08-13",
    });

    expect(scenario.requiredLeadsPerWeek).toBeNull();
    expect(scenario.projectedArrAtTargetDate).toBeLessThan(10_000);
  });

  it("returns zero months after a deadline and never negative gaps", () => {
    expect(monthsThroughDate("2029-01-01", "2028-12-31")).toBe(0);
    expect(weeksThroughDate("2029-01-01", "2028-12-31")).toBe(0);
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
