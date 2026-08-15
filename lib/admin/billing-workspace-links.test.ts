import { describe, expect, it } from "vitest";
import { billingMembershipAnchorId } from "./billing-workspace-links";

describe("billing workspace links", () => {
  it("creates bounded URL-safe membership anchors", () => {
    expect(billingMembershipAnchorId(" membership/0406 ")).toBe(
      "billing-membership-0406",
    );
    expect(billingMembershipAnchorId("***")).toBe("billing-unknown");
    expect(billingMembershipAnchorId("a".repeat(250))).toHaveLength(
      "billing-".length + 180,
    );
  });
});
