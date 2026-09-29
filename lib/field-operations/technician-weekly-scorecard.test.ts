import { describe, expect, it } from "vitest";
import { technicianWeeklyScorecard } from "./technician-weekly-scorecard";

describe("owner-only technician weekly scorecard", () => {
  it("separates recorded time, missing time, and unverified reported add-ons", () => {
    const result = technicianWeeklyScorecard({
      weekStart: "2026-09-28",
      weekEndExclusive: "2026-10-05",
      weekStartUtc: "2026-09-28T07:00:00.000Z",
      weekEndUtc: "2026-10-05T07:00:00.000Z",
      closeouts: [
        { assignment_id: "a", visit_date: "2026-09-28" },
        { assignment_id: "b", visit_date: "2026-09-29" },
        { assignment_id: "old", visit_date: "2026-09-27" },
      ],
      nativeClocks: [
        { assignment_id: "a", started_at: "2026-09-28T15:00:00.000Z", ended_at: "2026-09-28T17:30:00.000Z" },
        { assignment_id: "old", started_at: "2026-09-27T15:00:00.000Z", ended_at: "2026-09-27T16:00:00.000Z" },
      ],
      legacyClocks: [],
      manualEntries: [],
      addons: [
        { reported_at: "2026-09-29T13:00:00-07:00", reported_amount_cents: 4000, voided_at: null },
        { reported_at: "2026-09-29T21:00:00.000Z", reported_amount_cents: 5000, voided_at: "2026-09-30T15:00:00.000Z" },
      ],
    });
    expect(result).toMatchObject({ completedJobs: 2, clockedMinutes: 150, manualMinutes: 0, missingTimeJobs: 1, reportedAddonCount: 1, reportedAddonAmountCents: 4000 });
  });
});
