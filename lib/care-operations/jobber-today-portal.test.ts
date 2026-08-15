import { describe, expect, it } from "vitest";
import {
  buildJobberTodayPortalPath,
  isMissingMembershipPortalAccessSchema,
} from "./jobber-today-portal";

describe("Today customer portal verification", () => {
  it("builds an encoded relative path from an existing membership token", () => {
    expect(buildJobberTodayPortalPath("  member/token + proof  ")).toBe(
      "/portal/member%2Ftoken%20%2B%20proof",
    );
  });

  it("refuses empty or non-string portal tokens", () => {
    expect(buildJobberTodayPortalPath("   ")).toBeNull();
    expect(buildJobberTodayPortalPath(null)).toBeNull();
    expect(buildJobberTodayPortalPath(42)).toBeNull();
  });

  it("fails softly only when the portal token schema itself is missing", () => {
    expect(
      isMissingMembershipPortalAccessSchema({
        code: "42703",
        message: 'column "portal_access_token" does not exist',
      }),
    ).toBe(true);
    expect(
      isMissingMembershipPortalAccessSchema({
        code: "42501",
        message: "permission denied for table memberships",
      }),
    ).toBe(false);
    expect(
      isMissingMembershipPortalAccessSchema({
        code: "42703",
        message: 'column "unrelated_column" does not exist',
      }),
    ).toBe(false);
  });
});
