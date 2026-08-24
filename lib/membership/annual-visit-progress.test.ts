import { describe, expect, it } from "vitest";
import {
  buildMembershipAnnualVisitProgress,
  resolveCurrentMembershipPlanYear,
  type MembershipVisitProgressInput,
} from "./annual-visit-progress";

function visit(
  id: string,
  scheduledAt: string,
  status: MembershipVisitProgressInput["status"],
): MembershipVisitProgressInput {
  return {
    id,
    scheduledAt,
    status,
    serviceLabel: "Window cleaning",
    timeWindow: null,
    source: "verified_jobber_appointment",
  };
}

describe("membership annual visit progress", () => {
  it("uses the current contract anniversary instead of the calendar year", () => {
    expect(
      resolveCurrentMembershipPlanYear(
        "2025-10-15T18:00:00.000Z",
        new Date("2026-08-24T19:00:00.000Z"),
      ),
    ).toEqual({
      startsAt: "2025-10-15T18:00:00.000Z",
      endsAt: "2026-10-15T18:00:00.000Z",
    });
  });

  it("tracks completed, booked, and still-unbooked visits without requiring the full year", () => {
    const progress = buildMembershipAnnualVisitProgress({
      membershipCreatedAt: "2026-01-10T18:00:00.000Z",
      visitsPerYear: 3,
      referenceDate: new Date("2026-08-24T19:00:00.000Z"),
      visits: [
        visit("completed", "2026-04-10T16:00:00.000Z", "completed"),
        visit("next", "2026-10-10T16:00:00.000Z", "scheduled"),
        visit("cancelled", "2026-06-10T16:00:00.000Z", "cancelled"),
      ],
    });

    expect(progress.completed).toBe(1);
    expect(progress.scheduled).toBe(1);
    expect(progress.stillToBook).toBe(1);
    expect(progress.upcoming.map((item) => item.id)).toEqual(["next"]);
  });

  it("does not request more scheduling after the plan year is fulfilled", () => {
    const progress = buildMembershipAnnualVisitProgress({
      membershipCreatedAt: "2026-01-10T18:00:00.000Z",
      visitsPerYear: 2,
      referenceDate: new Date("2026-08-24T19:00:00.000Z"),
      visits: [
        visit("one", "2026-03-10T16:00:00.000Z", "completed"),
        visit("two", "2026-06-10T16:00:00.000Z", "completed"),
      ],
    });

    expect(progress.stillToBook).toBe(0);
    expect(progress.upcoming).toEqual([]);
  });
});
