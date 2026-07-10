import { describe, expect, it } from "vitest";
import {
  parseInternalNoteFromNotes,
  parseTimeWindowFromNotes,
  validateScheduleMembershipServiceInput,
} from "./schedule-membership-service";

describe("schedule-membership-service helpers", () => {
  it("validates service date format", () => {
    expect(
      validateScheduleMembershipServiceInput({
        membershipId: "mem-1",
        serviceDate: "2026-08-15",
      }),
    ).toBeNull();
    expect(
      validateScheduleMembershipServiceInput({
        membershipId: "mem-1",
        serviceDate: "08/15/2026",
      }),
    ).toBeTruthy();
  });

  it("parses time window and internal note from appointment notes", () => {
    const notes = "Gate stays unlocked\nTime window: Morning · 8am–12pm";
    expect(parseTimeWindowFromNotes(notes)).toBe("Morning · 8am–12pm");
    expect(parseInternalNoteFromNotes(notes)).toBe("Gate stays unlocked");
  });

  it("rejects invalid appointment types", () => {
    expect(
      validateScheduleMembershipServiceInput({
        membershipId: "mem-1",
        serviceDate: "2026-08-15",
        appointmentType: "invalid_type" as never,
      }),
    ).toBeTruthy();
  });
});
