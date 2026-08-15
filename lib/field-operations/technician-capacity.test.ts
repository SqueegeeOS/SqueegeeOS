import { describe, expect, it } from "vitest";
import {
  deriveTechnicianCapacityWeek,
  validateTechnicianCapacityPlanInput,
  type TechnicianCapacityPlan,
} from "./technician-capacity";

const plan: TechnicianCapacityPlan = {
  id: "plan-1",
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  jobberUserId: "jarad-jobber-id",
  displayName: "Jarad",
  effectiveWeekStart: "2026-08-10",
  weeklyCapacityMinutes: 1_920,
  planningHourlyCostCents: 2_500,
  notes: null,
  recordedBy: "HomeAtlas HQ",
  recordedAt: "2026-08-10T16:00:00.000Z",
};

describe("technician capacity", () => {
  it("shows exact booked, remaining, utilization, and planning labor cost", () => {
    const result = deriveTechnicianCapacityWeek({
      weekStart: "2026-08-10",
      weekEndExclusive: "2026-08-17",
      plan,
      sourceAvailable: true,
      scheduledStops: 8,
      scheduledMinutes: 1_200,
    });

    expect(result).toMatchObject({
      state: "ready",
      scheduledStops: 8,
      scheduledMinutes: 1_200,
      capacityMinutes: 1_920,
      remainingMinutes: 720,
      utilizationPercent: 62.5,
      planningLaborCostCents: 50_000,
      overCapacity: false,
    });
  });

  it("surfaces declared over-capacity without inventing a demand forecast", () => {
    const result = deriveTechnicianCapacityWeek({
      weekStart: "2026-08-10",
      weekEndExclusive: "2026-08-17",
      plan,
      sourceAvailable: true,
      scheduledStops: 13,
      scheduledMinutes: 2_100,
    });

    expect(result.overCapacity).toBe(true);
    expect(result.remainingMinutes).toBe(-180);
    expect(result.detail).toContain("exceed");
  });

  it("treats missing plans and unreadable Jobber evidence as unknown", () => {
    expect(
      deriveTechnicianCapacityWeek({
        weekStart: "2026-08-10",
        weekEndExclusive: "2026-08-17",
        plan: null,
        sourceAvailable: true,
        scheduledStops: 4,
        scheduledMinutes: 300,
      }),
    ).toMatchObject({ state: "no_plan", capacityMinutes: null });
    expect(
      deriveTechnicianCapacityWeek({
        weekStart: "2026-08-10",
        weekEndExclusive: "2026-08-17",
        plan,
        sourceAvailable: false,
        scheduledStops: 4,
        scheduledMinutes: 300,
      }),
    ).toMatchObject({
      state: "source_unavailable",
      scheduledStops: null,
      scheduledMinutes: null,
      remainingMinutes: null,
    });
  });

  it("validates explicit planning inputs", () => {
    expect(
      validateTechnicianCapacityPlanInput({
        clientRequestId: "11111111-1111-4111-8111-111111111111",
        jobberUserId: "jarad-jobber-id",
        displayName: "Jarad",
        effectiveWeekStart: "2026-08-10",
        weeklyCapacityMinutes: 1_920,
        planningHourlyCostCents: 2_500,
        notes: "Four eight-hour production days.",
      }),
    ).toBeNull();
    expect(
      validateTechnicianCapacityPlanInput({
        clientRequestId: "bad",
        jobberUserId: "jarad-jobber-id",
        displayName: "Jarad",
        effectiveWeekStart: "2026-08-10",
        weeklyCapacityMinutes: 5_000,
        planningHourlyCostCents: 2_500,
      }),
    ).not.toBeNull();
  });
});
