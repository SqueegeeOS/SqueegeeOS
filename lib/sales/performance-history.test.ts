import { describe, expect, it } from "vitest";
import { buildSalesPerformanceHistory } from "./performance-history";

describe("sales performance history", () => {
  it("keeps daily counters separate while preserving the multi-day record", () => {
    const history = buildSalesPerformanceHistory({
      referenceDate: new Date("2026-08-29T19:00:00.000Z"),
      rangeDays: 3,
      activities: [
        { event_type: "door_knock", quantity: 12, occurred_at: "2026-08-28T22:00:00.000Z" },
        { event_type: "conversation", quantity: 6, occurred_at: "2026-08-28T22:05:00.000Z" },
        { event_type: "presentation_started", quantity: 3, occurred_at: "2026-08-29T18:00:00.000Z" },
      ],
      leadCreatedAt: ["2026-08-29T18:05:00.000Z"],
      attributions: [
        { qualification_status: "active", attributed_arr_cents: 84000, attributed_at: "2026-08-29T18:10:00.000Z" },
      ],
    });

    expect(history.days.at(-2)).toMatchObject({ date: "2026-08-28", doors: 12, homeownersTalkedTo: 6, presentations: 0 });
    expect(history.days.at(-1)).toMatchObject({ date: "2026-08-29", doors: 0, homeownersTalkedTo: 0, presentations: 3, leads: 1, wins: 1, closedArrCents: 84000 });
    expect(history.totals).toMatchObject({ doors: 12, homeownersTalkedTo: 6, presentations: 3, leads: 1, wins: 1 });
    expect(history.conversationRatePercent).toBe(50);
    expect(history.presentationRatePercent).toBe(50);
    expect(history.closeRatePercent).toBeCloseTo(33.3);
  });

  it("ignores cancelled wins and events outside the requested window", () => {
    const history = buildSalesPerformanceHistory({
      referenceDate: new Date("2026-08-29T19:00:00.000Z"),
      rangeDays: 2,
      activities: [{ event_type: "door_knock", quantity: 50, occurred_at: "2026-08-20T19:00:00.000Z" }],
      leadCreatedAt: [],
      attributions: [{ qualification_status: "cancelled", attributed_arr_cents: 99900, attributed_at: "2026-08-29T18:10:00.000Z" }],
    });

    expect(history.totals.doors).toBe(0);
    expect(history.totals.wins).toBe(0);
    expect(history.totals.closedArrCents).toBe(0);
  });
});
