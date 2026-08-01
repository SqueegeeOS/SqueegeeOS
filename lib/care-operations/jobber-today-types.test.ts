import { describe, expect, it } from "vitest";
import {
  classifyJobberTodayVisit,
  isJobberTodayDataStale,
} from "./jobber-today-types";

const scheduledVisit = {
  isComplete: false,
  scheduledStart: "2026-08-01T16:00:00.000Z",
  scheduledEnd: "2026-08-01T18:00:00.000Z",
};

describe("Jobber Today board states", () => {
  it("uses completion as the authoritative terminal state", () => {
    expect(
      classifyJobberTodayVisit(
        { ...scheduledVisit, isComplete: true },
        new Date("2026-08-01T15:00:00.000Z"),
      ),
    ).toBe("complete");
  });

  it("distinguishes upcoming, active, and late scheduled visits", () => {
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T15:00:00.000Z"),
      ),
    ).toBe("upcoming");
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T17:00:00.000Z"),
      ),
    ).toBe("in_progress");
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T19:00:00.000Z"),
      ),
    ).toBe("late");
  });

  it("flags missing, invalid, and older synchronization snapshots", () => {
    const now = new Date("2026-08-01T20:00:00.000Z");
    expect(isJobberTodayDataStale(null, now)).toBe(true);
    expect(isJobberTodayDataStale("not-a-date", now)).toBe(true);
    expect(
      isJobberTodayDataStale("2026-08-01T15:00:00.000Z", now),
    ).toBe(false);
    expect(
      isJobberTodayDataStale("2026-08-01T13:59:59.000Z", now),
    ).toBe(true);
  });
});
