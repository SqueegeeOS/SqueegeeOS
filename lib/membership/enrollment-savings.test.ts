import { describe, expect, it } from "vitest";
import {
  cumulativeMembershipEnrollmentSavings,
  defaultEnrollmentSavingsForTier,
  resolveEnrollmentSavings,
} from "./enrollment-savings";

describe("enrollment savings", () => {
  it("defaults to tier premium", () => {
    expect(defaultEnrollmentSavingsForTier("biannual")).toBe(100);
    expect(defaultEnrollmentSavingsForTier("quarterly")).toBe(150);
  });

  it("respects explicit presentation override", () => {
    expect(resolveEnrollmentSavings(125, "biannual")).toBe(125);
  });

  it("accumulates completed visit savings only", () => {
    expect(cumulativeMembershipEnrollmentSavings(100, 7)).toBe(700);
    expect(cumulativeMembershipEnrollmentSavings(100, 0)).toBe(0);
  });
});
