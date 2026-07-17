import { describe, expect, it } from "vitest";
import {
  computeCareCreditCents,
  milestonesMissingRewards,
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

describe("milestonesMissingRewards", () => {
  it("is empty when nothing is converted", () => {
    expect(milestonesMissingRewards(0, [])).toEqual([]);
  });

  it("flags reached milestones with no reward row", () => {
    const missing = milestonesMissingRewards(3, [
      { milestoneConvertedCount: 1 },
    ]);
    expect(missing.map((m) => m.convertedCount)).toEqual([3]);
  });

  it("is empty when every reached milestone has a reward row", () => {
    const missing = milestonesMissingRewards(3, [
      { milestoneConvertedCount: 1 },
      { milestoneConvertedCount: 3 },
    ]);
    expect(missing).toEqual([]);
  });

  it("ignores milestones not yet reached", () => {
    expect(milestonesMissingRewards(1, []).map((m) => m.convertedCount)).toEqual(
      [1],
    );
  });
});

describe("computeCareCreditCents (earned is not spendable)", () => {
  const earned25 = {
    milestoneConvertedCount: 1,
    rewardType: "care_credit" as const,
    status: "earned" as const,
    valueCents: 2500,
  };
  const available25 = { ...earned25, status: "available" as const };
  const redeemed25 = { ...earned25, status: "redeemed" as const };
  const earnedPercent = {
    milestoneConvertedCount: 5,
    rewardType: "percent_discount" as const,
    status: "earned" as const,
    valueCents: null,
  };

  it("counts only claimed (available) credit as spendable", () => {
    const result = computeCareCreditCents([earned25]);
    expect(result.availableCreditCents).toBe(0);
    expect(result.earnedCreditCents).toBe(2500);
  });

  it("moves credit from earned to available after a claim", () => {
    const result = computeCareCreditCents([available25]);
    expect(result.availableCreditCents).toBe(2500);
    expect(result.earnedCreditCents).toBe(0);
  });

  it("excludes redeemed credit from both balances", () => {
    const result = computeCareCreditCents([redeemed25]);
    expect(result.availableCreditCents).toBe(0);
    expect(result.earnedCreditCents).toBe(0);
  });

  it("treats earned percent rewards as not yet usable", () => {
    const result = computeCareCreditCents([earnedPercent]);
    expect(result.hasAvailablePercentReward).toBe(false);
    expect(
      computeCareCreditCents([{ ...earnedPercent, status: "available" }])
        .hasAvailablePercentReward,
    ).toBe(true);
  });
});
