import { describe, expect, it } from "vitest";
import {
  normalizeNorthAmericanPhone,
  validateCreateSalesActivity,
  validateCreateSalesLead,
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
