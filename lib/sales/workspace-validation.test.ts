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
      value: { activityType: "door_knock", quantity: 1, leadId: null },
    });
    expect(
      validateCreateSalesActivity({ activityType: "door_knock", quantity: 101 }),
    ).toEqual({
      ok: false,
      error: "Activity count must be between 1 and 100.",
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
