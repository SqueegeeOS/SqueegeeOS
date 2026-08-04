import { describe, expect, it } from "vitest";
import {
  getSalesActivityUndoExpiresAt,
  isSalesActivityUndoAvailable,
  SALES_ACTIVITY_UNDO_WINDOW_MS,
} from "./activity-reversal";

const occurredAt = "2026-08-03T18:00:00.000Z";

describe("sales activity reversal policy", () => {
  it("allows a recent standalone quick action", () => {
    expect(
      isSalesActivityUndoAvailable(
        {
          eventType: "membership_signed",
          leadId: null,
          occurredAt,
          reversedAt: null,
        },
        new Date(Date.parse(occurredAt) + SALES_ACTIVITY_UNDO_WINDOW_MS),
      ),
    ).toBe(true);
  });

  it("rejects expired, lead-linked, and already-reversed activity", () => {
    const baseCandidate = {
      eventType: "door_knock" as const,
      leadId: null,
      occurredAt,
      reversedAt: null,
    };

    expect(
      isSalesActivityUndoAvailable(
        baseCandidate,
        new Date(Date.parse(occurredAt) + SALES_ACTIVITY_UNDO_WINDOW_MS + 1),
      ),
    ).toBe(false);
    expect(
      isSalesActivityUndoAvailable(
        { ...baseCandidate, leadId: "00000000-0000-4000-8000-000000000001" },
        new Date(occurredAt),
      ),
    ).toBe(false);
    expect(
      isSalesActivityUndoAvailable(
        { ...baseCandidate, reversedAt: "2026-08-03T18:01:00.000Z" },
        new Date(occurredAt),
      ),
    ).toBe(false);
  });

  it("never reverses durable workflow events", () => {
    expect(
      isSalesActivityUndoAvailable(
        {
          eventType: "lead_captured",
          leadId: null,
          occurredAt,
          reversedAt: null,
        },
        new Date(occurredAt),
      ),
    ).toBe(false);
  });

  it("derives the same server-authoritative expiry returned to clients", () => {
    expect(getSalesActivityUndoExpiresAt(occurredAt)).toBe(
      "2026-08-03T18:10:00.000Z",
    );
    expect(getSalesActivityUndoExpiresAt("not-a-date")).toBeNull();
  });
});
