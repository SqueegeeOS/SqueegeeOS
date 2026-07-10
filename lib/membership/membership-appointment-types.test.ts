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
});
