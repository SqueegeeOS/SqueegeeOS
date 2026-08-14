import { describe, expect, it } from "vitest";
import { formatMembershipCareVisitLabel } from "./membership-appointment-types";

describe("formatMembershipCareVisitLabel", () => {
  it("uses HomeAtlas quarterly membership language", () => {
    expect(
      formatMembershipCareVisitLabel("quarterly", "home_care_visit"),
    ).toBe("Quarterly Home Care Visit");
  });

  it("uses HomeAtlas bi-annual membership language", () => {
    expect(
      formatMembershipCareVisitLabel("biannual", "home_care_visit"),
    ).toBe("Bi-Annual Exterior Window Care");
  });

  it("uses truthful optional three-visit membership language", () => {
    expect(
      formatMembershipCareVisitLabel("triannual", "home_care_visit"),
    ).toBe("3× Per Year Exterior Window Care");
    expect(
      formatMembershipCareVisitLabel("3x per year", "exterior_windows"),
    ).toBe("3× Per Year Exterior Window Care");
  });
});
