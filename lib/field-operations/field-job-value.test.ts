import { describe, expect, it } from "vitest";
import { canTechnicianViewJobValue, fieldJobValue } from "./field-job-value";
import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

describe("technician job pricing", () => {
  it("grants only Tyler's stable technician identity", () => {
    expect(canTechnicianViewJobValue(`homeatlas:${TYLER_GERMANY_TECHNICIAN_ID}`)).toBe(true);
    for (const identity of ["Tyler Germany", "homeatlas:tyler", "other", ""]) {
      expect(canTechnicianViewJobValue(identity)).toBe(false);
    }
  });
  it("preserves cents and genuine zero while leaving unknown or invalid prices unavailable", () => {
    expect(fieldJobValue(50025, "jobber")).toEqual({ amountCents: 50025, source: "jobber" });
    expect(fieldJobValue(0, "hq").amountCents).toBe(0);
    for (const invalid of [undefined, null, -100, NaN, Infinity, 1.5, "50000"]) {
      expect(fieldJobValue(invalid, "jobber").amountCents).toBeNull();
    }
  });
});
