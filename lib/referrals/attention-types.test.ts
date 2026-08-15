import { describe, expect, it } from "vitest";
import { referralMemberAnchorId } from "./attention-types";

describe("referral attention links", () => {
  it("creates bounded URL-safe membership anchors", () => {
    expect(referralMemberAnchorId(" membership/0406 ")).toBe(
      "referral-member-membership-0406",
    );
    expect(referralMemberAnchorId("***")).toBe("referral-member-unknown");
    expect(referralMemberAnchorId("a".repeat(250))).toHaveLength(
      "referral-member-".length + 180,
    );
  });
});
