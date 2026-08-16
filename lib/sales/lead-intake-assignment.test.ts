import { describe, expect, it } from "vitest";
import {
  salesLeadSourceLabel,
  validateLeadIntakeAssignment,
} from "./lead-intake-assignment";

describe("lead intake sales assignment", () => {
  const reference = new Date("2026-08-16T18:00:00.000Z");

  it("requires one active-looking rep slug and an explicit future next action", () => {
    expect(
      validateLeadIntakeAssignment(
        { repSlug: "David", nextFollowUpAt: "2026-08-17T18:00:00.000Z" },
        reference,
      ),
    ).toEqual({
      ok: true,
      value: {
        repSlug: "david",
        nextFollowUpAt: "2026-08-17T18:00:00.000Z",
      },
    });
    expect(
      validateLeadIntakeAssignment(
        { repSlug: "david", nextFollowUpAt: reference.toISOString() },
        reference,
      ),
    ).toEqual({ ok: false, error: "The next action must be in the future." });
  });

  it("keeps acquisition source labels explicit in the private queue", () => {
    expect(salesLeadSourceLabel("request_form")).toBe("Website request");
    expect(salesLeadSourceLabel("facebook_lead_ad")).toBe("Facebook lead");
    expect(salesLeadSourceLabel("door_to_door")).toBe("Door-to-door");
  });
});
