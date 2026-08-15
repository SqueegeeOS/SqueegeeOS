import { describe, expect, it } from "vitest";
import {
  annualCareCheckinOpportunity,
  customerAftercareTaskAnchorId,
  isReviewOpportunityReady,
  outcomeMatchesAftercareTask,
  resolutionForAftercareOutcome,
  reviewOpportunityTaskKey,
} from "./customer-aftercare";

const APPOINTMENT_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";

describe("customer aftercare decisions", () => {
  it("opens a bounded review window after the first 24 hours", () => {
    const now = new Date("2026-08-14T18:00:00.000Z");
    expect(isReviewOpportunityReady("2026-08-13T18:00:01.000Z", now)).toBe(false);
    expect(isReviewOpportunityReady("2026-08-13T17:59:59.000Z", now)).toBe(true);
    expect(isReviewOpportunityReady("2026-07-20T18:00:00.000Z", now)).toBe(false);
  });

  it("builds stable task keys and URL-safe bounded anchors", () => {
    expect(reviewOpportunityTaskKey(APPOINTMENT_ID)).toBe(
      `review-opportunity:${APPOINTMENT_ID}`,
    );
    expect(reviewOpportunityTaskKey("not-an-id")).toBeNull();
    const anchor = customerAftercareTaskAnchorId(
      `${"bad/key?".repeat(40)}:${APPOINTMENT_ID}`,
    );
    expect(anchor).toMatch(/^aftercare-task-[a-zA-Z0-9_-]+$/);
    expect(anchor.length).toBeLessThanOrEqual(195);
  });

  it("surfaces the first annual check-in in a Pacific calendar window", () => {
    const opportunity = annualCareCheckinOpportunity({
      membershipId: MEMBERSHIP_ID,
      membershipStartedAt: "2025-08-20T01:00:00.000Z",
      now: new Date("2026-08-14T18:00:00.000Z"),
    });
    expect(opportunity).toEqual({
      taskKey: `annual-care-checkin:${MEMBERSHIP_ID}:2026`,
      dueAt: "2026-08-19T16:00:00.000Z",
      anniversaryNumber: 1,
    });
  });

  it("clamps leap-day anniversaries and ignores dates outside the care window", () => {
    expect(
      annualCareCheckinOpportunity({
        membershipId: MEMBERSHIP_ID,
        membershipStartedAt: "2024-02-29T20:00:00.000Z",
        now: new Date("2025-02-20T18:00:00.000Z"),
      })?.dueAt,
    ).toBe("2025-02-28T17:00:00.000Z");
    expect(
      annualCareCheckinOpportunity({
        membershipId: MEMBERSHIP_ID,
        membershipStartedAt: "2025-12-01T20:00:00.000Z",
        now: new Date("2026-08-14T18:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("keeps outcomes specific to their task and derives dismissal safely", () => {
    expect(outcomeMatchesAftercareTask("review_opportunity", "review_requested")).toBe(true);
    expect(outcomeMatchesAftercareTask("review_opportunity", "checkin_completed")).toBe(false);
    expect(outcomeMatchesAftercareTask("annual_care_checkin", "not_needed")).toBe(true);
    expect(resolutionForAftercareOutcome("not_appropriate")).toBe("dismissed");
    expect(resolutionForAftercareOutcome("already_reviewed")).toBe("completed");
  });
});
