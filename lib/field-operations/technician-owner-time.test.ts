import { describe, expect, it } from "vitest";
import { ownerResolvedOverlapEnd, type OwnerTimeAdjustmentRow } from "./technician-owner-time";
import { technicianWeeklyScorecard } from "./technician-weekly-scorecard";

const adjustment: OwnerTimeAdjustmentRow = {
  id: "adjustment", technician_id: "tech", work_date: "2026-11-06", duration_minutes: 180,
  resolved_clock_id: null, reason: "owner_added_time", note: "Owner requested 3 hours", entered_by: "HQ", entered_at: "2026-11-13T20:00:00Z",
};
const base = {
  weekStart: "2026-11-02", weekEndExclusive: "2026-11-09",
  weekStartUtc: "2026-11-02T08:00:00Z", weekEndUtc: "2026-11-09T08:00:00Z",
  closeouts: [], nativeClocks: [], legacyClocks: [], manualEntries: [], addons: [],
};

describe("owner duration evidence", () => {
  it("counts date-only hours separately, with no fabricated timestamps", () => {
    const result = technicianWeeklyScorecard({ ...base, ownerAdjustments: [adjustment] });
    expect(result.manualMinutes).toBe(180);
    expect(result.clockedMinutes).toBe(0);
    expect(adjustment).not.toHaveProperty("started_at");
    expect(adjustment).not.toHaveProperty("ended_at");
  });
  it("uses Pacific work dates and excludes adjustments outside the week", () => {
    expect(technicianWeeklyScorecard({ ...base, ownerAdjustments: [{ ...adjustment, work_date: "2026-11-09" }] }).manualMinutes).toBe(0);
  });
  it("avoids double-counting a subsequently completed resolved clock", () => {
    const result = technicianWeeklyScorecard({ ...base,
      nativeClocks: [{ id: "clock", assignment_id: "job", started_at: "2026-11-06T17:00:00Z", ended_at: "2026-11-06T19:00:00Z" }],
      closeouts: [{ assignment_id: "job", visit_date: "2026-11-06" }],
      ownerAdjustments: [{ ...adjustment, resolved_clock_id: "clock" }],
    });
    expect(result).toMatchObject({ clockedMinutes: 0, manualMinutes: 180, missingTimeJobs: 0 });
  });
  it("uses estimate only for overlap, retaining original clock evidence", () => {
    const clock = { id: "clock", started_at: "2026-09-08T16:02:20.967934Z", ended_at: null };
    expect(ownerResolvedOverlapEnd(clock, [{ resolved_clock_id: "clock", duration_minutes: 90 }])).toBe("2026-09-08T17:32:20.967Z");
    expect(clock.ended_at).toBeNull();
    expect(ownerResolvedOverlapEnd(clock, [])).toBeNull();
  });
  it("retains actual completed clock end for overlap checks", () => {
    const clock = { id: "clock", started_at: "2026-09-08T16:00:00Z", ended_at: "2026-09-08T18:00:00Z" };
    expect(ownerResolvedOverlapEnd(clock, [{ resolved_clock_id: "clock", duration_minutes: 90 }])).toBe(clock.ended_at);
  });
});
