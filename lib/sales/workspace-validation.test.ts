import { describe, expect, it } from "vitest";
import {
  normalizeNorthAmericanPhone,
  validateCreateSalesActivity,
  validateCreateSalesDoorMemory,
  validateCreateSalesLead,
  validateRecordSalesLeadInteraction,
  validateUpdateSalesLead,
  validateUndoSalesActivity,
} from "./workspace-validation";

describe("sales workspace validation", () => {
  it("normalizes common US phone formats", () => {
    expect(normalizeNorthAmericanPhone("(702) 555-1212")).toBe("+17025551212");
    expect(normalizeNorthAmericanPhone("+447911123456")).toBe("+447911123456");
    expect(normalizeNorthAmericanPhone("123")).toBeNull();
  });

  it("requires a reachable contact and explicit permission evidence", () => {
    expect(
      validateCreateSalesLead({
        fullName: "Jordan Homeowner",
        propertyAddress: "123 Atlas Way",
      }),
    ).toEqual({ ok: false, error: "Add a phone number or email address." });

    expect(
      validateCreateSalesLead({
        fullName: "Jordan Homeowner",
        propertyAddress: "123 Atlas Way",
        email: "jordan@example.com",
        smsConsentAttested: true,
      }),
    ).toEqual({
      ok: false,
      error: "A phone number is required for text permission.",
    });
  });

  it("returns normalized, bounded lead data", () => {
    const result = validateCreateSalesLead({
      fullName: "  Jordan Homeowner  ",
      propertyAddress: "  123 Atlas Way  ",
      phone: "702-555-1212",
      email: "JORDAN@EXAMPLE.COM",
      estimatedArrDollars: 1800,
      smsConsentAttested: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        fullName: "Jordan Homeowner",
        propertyAddress: "123 Atlas Way",
        phone: "+17025551212",
        email: "jordan@example.com",
        estimatedArrDollars: 1800,
        smsConsentAttested: true,
      });
    }
  });

  it("accepts only bounded field pulse activities", () => {
    expect(
      validateCreateSalesActivity({ activityType: "door_knock", quantity: 1 }),
    ).toEqual({
      ok: true,
      value: {
        activityType: "door_knock",
        quantity: 1,
        leadId: null,
        clientEventId: null,
        occurredAt: null,
      },
    });
    expect(
      validateCreateSalesActivity({ activityType: "door_knock", quantity: 101 }),
    ).toEqual({
      ok: false,
      error: "Activity count must be between 1 and 100.",
    });
    expect(
      validateCreateSalesActivity({ activityType: "membership_signed" }),
    ).toEqual({
      ok: false,
      error: "Signed memberships are recorded automatically from the agreement.",
    });
  });

  it("accepts bounded, idempotent address-level door outcomes", () => {
    const result = validateCreateSalesDoorMemory({
      doorActivityClientEventId: "00000000-0000-4000-8000-000000000042",
      clientEventId: "00000000-0000-4000-8000-000000000043",
      propertyAddress: "  1420   Davis St., Chico CA  ",
      disposition: "follow_up",
      notes: "Try again after 5 PM.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        propertyAddress: "1420 Davis St., Chico CA",
        addressKey: "1420 davis st chico ca",
        disposition: "follow_up",
        notes: "Try again after 5 PM.",
        leadId: null,
      });
    }
  });

  it("rejects ambiguous or reused door-memory identity", () => {
    const sharedId = "00000000-0000-4000-8000-000000000042";
    expect(
      validateCreateSalesDoorMemory({
        doorActivityClientEventId: sharedId,
        clientEventId: sharedId,
        propertyAddress: "1420 Davis St",
        disposition: "not_home",
      }),
    ).toEqual({
      ok: false,
      error: "Door activity and memory require separate retry references.",
    });
    expect(
      validateCreateSalesDoorMemory({
        doorActivityClientEventId: sharedId,
        clientEventId: "00000000-0000-4000-8000-000000000043",
        propertyAddress: "1420 Davis St",
        disposition: "maybe_later",
      }),
    ).toEqual({ ok: false, error: "Choose what happened at this door." });
  });

  it("requires an owned next action for open lead updates", () => {
    expect(
      validateUpdateSalesLead({
        leadId: "00000000-0000-4000-8000-000000000001",
        status: "follow_up",
        estimatedArrDollars: 1200,
        notes: "Call after work",
      }),
    ).toEqual({
      ok: false,
      error: "Choose when this homeowner should return to the action queue.",
    });

    const result = validateUpdateSalesLead({
      leadId: "00000000-0000-4000-8000-000000000001",
      status: "considering",
      estimatedArrDollars: 1800,
      nextFollowUpAt: "2026-08-20T18:30:00.000Z",
      notes: "Reviewing the quarterly option with their spouse.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        status: "considering",
        nextFollowUpAt: "2026-08-20T18:30:00.000Z",
      });
    }
  });

  it("keeps agreement outcomes automatic and requires a lost reason", () => {
    expect(
      validateUpdateSalesLead({
        leadId: "00000000-0000-4000-8000-000000000001",
        status: "signed",
        estimatedArrDollars: 1200,
      }),
    ).toEqual({
      ok: false,
      error: "Signed customers are advanced automatically from their agreement.",
    });
    expect(
      validateUpdateSalesLead({
        leadId: "00000000-0000-4000-8000-000000000001",
        status: "lost",
        estimatedArrDollars: 1200,
        notes: "",
      }),
    ).toEqual({
      ok: false,
      error: "Add a short reason before closing this lead.",
    });
  });

  it("normalizes an idempotent follow-up outcome with a future next action", () => {
    const nextFollowUpAt = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = validateRecordSalesLeadInteraction({
      leadId: "00000000-0000-4000-8000-000000000001",
      clientEventId: "00000000-0000-4000-8000-000000000099",
      channel: "call",
      outcome: "spoke_follow_up",
      note: "  Wants to compare quarterly and biannual care.  ",
      nextFollowUpAt,
      expectedLeadUpdatedAt: "2026-08-16T17:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        leadId: "00000000-0000-4000-8000-000000000001",
        clientEventId: "00000000-0000-4000-8000-000000000099",
        channel: "call",
        outcome: "spoke_follow_up",
        note: "Wants to compare quarterly and biannual care.",
        nextFollowUpAt,
        expectedLeadUpdatedAt: "2026-08-16T17:00:00.000Z",
      });
    }
  });

  it("requires durable context when a follow-up closes a lead", () => {
    const base = {
      leadId: "00000000-0000-4000-8000-000000000001",
      clientEventId: "00000000-0000-4000-8000-000000000099",
      channel: "in_person",
      outcome: "not_interested",
      expectedLeadUpdatedAt: "2026-08-16T17:00:00.000Z",
    };
    expect(validateRecordSalesLeadInteraction(base)).toEqual({
      ok: false,
      error: "Add a short reason before closing this lead.",
    });
    expect(
      validateRecordSalesLeadInteraction({
        ...base,
        note: "Moving out of the service area.",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        outcome: "not_interested",
        nextFollowUpAt: null,
      },
    });
  });

  it("rejects stale or unbounded follow-up actions", () => {
    expect(
      validateRecordSalesLeadInteraction({
        leadId: "00000000-0000-4000-8000-000000000001",
        clientEventId: "00000000-0000-4000-8000-000000000099",
        channel: "sms",
        outcome: "no_answer",
        nextFollowUpAt: new Date(Date.now() - 60_000).toISOString(),
        expectedLeadUpdatedAt: "2026-08-16T17:00:00.000Z",
      }),
    ).toEqual({
      ok: false,
      error: "Choose a future next action within one year.",
    });
  });

  it("accepts an idempotency key and only recent field event timestamps", () => {
    const now = new Date();
    const result = validateCreateSalesActivity({
      activityType: "conversation",
      clientEventId: "00000000-0000-4000-8000-000000000042",
      occurredAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.clientEventId).toBe(
        "00000000-0000-4000-8000-000000000042",
      );
      expect(result.value.occurredAt).not.toBeNull();
    }

    expect(
      validateCreateSalesActivity({
        activityType: "door_knock",
        occurredAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      }),
    ).toEqual({
      ok: false,
      error: "Queued field activity must be less than 24 hours old.",
    });
    expect(
      validateCreateSalesActivity({
        activityType: "door_knock",
        occurredAt: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
      }),
    ).toEqual({
      ok: false,
      error: "Activity time cannot be in the future.",
    });
  });

  it("requires an exact activity UUID before undo", () => {
    expect(
      validateUndoSalesActivity("00000000-0000-4000-8000-000000000001"),
    ).toEqual({
      ok: true,
      value: { activityId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(validateUndoSalesActivity("not-an-activity")).toEqual({
      ok: false,
      error: "Activity reference is invalid.",
    });
  });
});
