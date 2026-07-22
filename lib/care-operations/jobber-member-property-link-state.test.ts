import { describe, expect, it } from "vitest";
import { memberPropertyFilterChange } from "../../components/admin/jobber-member-property-link-state";

describe("Jobber member-property link selection state", () => {
  it("clears the selected membership and confirmation whenever filtering changes", () => {
    expect(memberPropertyFilterChange("new address")).toEqual({
      memberFilter: "new address",
      selectedMembershipId: "",
      samePropertyConfirmed: false,
    });
  });
});
