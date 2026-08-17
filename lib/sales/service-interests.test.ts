import { describe, expect, it } from "vitest";
import {
  isSalesServiceInterest,
  normalizeSalesServiceInterests,
  salesServiceInterestsFromLeadIntake,
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
    expect(isSalesServiceInterest("pressure_washing")).toBe(true);
    expect(salesServiceInterestLabel("cobweb_removal")).toBe("Cobwebs");
  });

  it("preserves every public request service in the private sales vocabulary", () => {
    expect(
      salesServiceInterestsFromLeadIntake([
        "Solar Panel Cleaning",
        "Pressure Washing",
        "Gutter Cleaning",
        "Full Home Care Membership",
      ]),
    ).toEqual([
      "exterior_windows",
      "solar_panels",
      "pressure_washing",
      "gutter_cleaning",
      "home_care_membership",
    ]);
  });

  it("keeps an unknown historical source label visible without inventing scope", () => {
    expect(salesServiceInterestsFromLeadIntake(["Roof wash"])).toEqual([
      "exterior_windows",
      "other",
    ]);
  });
});
