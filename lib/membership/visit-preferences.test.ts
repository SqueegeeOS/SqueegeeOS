import { describe, expect, it } from "vitest";
import { monthName, validatePreferredVisitMonths } from "./visit-preferences";

describe("membership visit preferences", () => {
  it("accepts the expected number of unique calendar months", () => {
    expect(validatePreferredVisitMonths([4, 10], 2)).toEqual([4, 10]);
  });

  it("rejects duplicate, missing, and out-of-range months", () => {
    expect(validatePreferredVisitMonths([4, 4], 2)).toBeNull();
    expect(validatePreferredVisitMonths([4], 2)).toBeNull();
    expect(validatePreferredVisitMonths([4, 13], 2)).toBeNull();
  });

  it("formats a month without inventing one", () => {
    expect(monthName(4)).toBe("April");
    expect(monthName(null)).toBe("Not chosen");
  });
});
