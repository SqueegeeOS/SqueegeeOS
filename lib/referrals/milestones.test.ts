import { describe, expect, it } from "vitest";
import {
  nextReferralMilestone,
  referralMilestoneForCount,
  REFERRAL_MILESTONES,
} from "./milestones";

describe("referral milestones", () => {
  it("defines four ascending converted-member thresholds", () => {
    expect(REFERRAL_MILESTONES).toHaveLength(4);
    expect(REFERRAL_MILESTONES.map((m) => m.convertedCount)).toEqual([
      1, 3, 5, 10,
    ]);
  });

  it("returns the milestone for an exact converted count", () => {
    expect(referralMilestoneForCount(1)?.label).toBe("$25 HomeAtlas Care Credit");
    expect(referralMilestoneForCount(3)?.valueCents).toBe(10000);
    expect(referralMilestoneForCount(5)?.valuePercent).toBe(10);
    expect(referralMilestoneForCount(10)?.valuePercent).toBe(20);
    expect(referralMilestoneForCount(2)).toBeNull();
  });

  it("returns the next unreached milestone", () => {
    expect(nextReferralMilestone(0)?.convertedCount).toBe(1);
    expect(nextReferralMilestone(1)?.convertedCount).toBe(3);
    expect(nextReferralMilestone(4)?.convertedCount).toBe(5);
    expect(nextReferralMilestone(9)?.convertedCount).toBe(10);
    expect(nextReferralMilestone(10)).toBeNull();
  });
});
