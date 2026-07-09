import { describe, expect, it } from "vitest";
import { isMissingColumnError } from "@/lib/persistence/queries/load-membership-portal-row";

describe("isMissingColumnError", () => {
  it("detects missing column errors from Supabase", () => {
    expect(
      isMissingColumnError(
        "column memberships.membership_enrollment_savings does not exist",
        "membership_enrollment_savings",
      ),
    ).toBe(true);
    expect(isMissingColumnError("permission denied", "membership_enrollment_savings")).toBe(
      false,
    );
  });
});
