import { describe, expect, it } from "vitest";
import {
  isSalesServiceInterest,
  normalizeSalesServiceInterests,
  salesServiceInterestLabel,
} from "./service-interests";

describe("sales service interests", () => {
  it("keeps exterior first while deduplicating valid field interests", () => {
    expect(
      normalizeSalesServiceInterests([
        "screens",
        "screens",
        "interior_windows",
        "not-a-service",
      ]),
    ).toEqual(["exterior_windows", "interior_windows", "screens"]);
  });

  it("provides safe defaults and customer-readable labels", () => {
    expect(normalizeSalesServiceInterests(undefined)).toEqual([
      "exterior_windows",
    ]);
    expect(isSalesServiceInterest("cobweb_removal")).toBe(true);
    expect(isSalesServiceInterest("pressure_washing")).toBe(false);
    expect(salesServiceInterestLabel("cobweb_removal")).toBe("Cobwebs");
  });
});
