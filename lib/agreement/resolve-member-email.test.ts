import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  resolveMemberEmail,
} from "./resolve-member-email";

describe("resolveMemberEmail", () => {
  it("returns first valid email", () => {
    expect(resolveMemberEmail("", "  test@example.com ", null)).toBe(
      "test@example.com",
    );
  });

  it("returns null when no valid email", () => {
    expect(resolveMemberEmail("", "not-an-email", undefined)).toBeNull();
  });

  it("normalizes valid email", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("Jane@Example.COM");
  });
});
