export type ReferralRewardType = "care_credit" | "percent_discount";

export type ReferralRewardStatus =
  | "earned"
  | "available"
  | "redeemed"
  | "expired";

export interface ReferralMilestoneDefinition {
  convertedCount: number;
  rewardType: ReferralRewardType;
  label: string;
  valueCents: number | null;
  valuePercent: number | null;
  description: string;
}

/**
 * HomeAtlas referral milestones — premium, sustainable, not coupon-like.
 * Only converted member referrals count toward milestones.
 */
export const REFERRAL_MILESTONES: ReferralMilestoneDefinition[] = [
  {
    convertedCount: 1,
    rewardType: "care_credit",
    label: "$25 HomeAtlas Care Credit",
    valueCents: 2500,
    valuePercent: null,
    description:
      "A $25 credit toward any HomeAtlas care service when your first referral joins the Care Network.",
  },
  {
    convertedCount: 3,
    rewardType: "care_credit",
    label: "$100 Care Credit",
    valueCents: 10000,
    valuePercent: null,
    description:
      "A $100 HomeAtlas Care Credit — our thank-you when three homes you referred are under care.",
  },
  {
    convertedCount: 5,
    rewardType: "percent_discount",
    label: "10% off one upcoming visit or service",
    valueCents: null,
    valuePercent: 10,
    description:
      "Ten percent off your next membership visit or add-on service — one time, when you're ready.",
  },
  {
    convertedCount: 10,
    rewardType: "percent_discount",
    label: "20% off one upcoming visit or annual membership credit",
    valueCents: null,
    valuePercent: 20,
    description:
      "Twenty percent off one upcoming visit, or applied as credit toward your annual membership — your choice when redeeming.",
  },
];

export function referralMilestoneForCount(
  convertedCount: number,
): ReferralMilestoneDefinition | null {
  return (
    REFERRAL_MILESTONES.find((m) => m.convertedCount === convertedCount) ??
    null
  );
}

export function nextReferralMilestone(
  convertedCount: number,
): ReferralMilestoneDefinition | null {
  return (
    REFERRAL_MILESTONES.find((m) => m.convertedCount > convertedCount) ?? null
  );
}

interface RewardLike {
  milestoneConvertedCount: number;
  rewardType: ReferralRewardType;
  status: ReferralRewardStatus;
  valueCents: number | null;
}

/**
 * Milestones the member has reached that have no reward row yet.
 * Non-empty means issuance fell behind conversions — HQ must reconcile.
 */
export function milestonesMissingRewards(
  convertedCount: number,
  rewards: Array<Pick<RewardLike, "milestoneConvertedCount">>,
): ReferralMilestoneDefinition[] {
  const present = new Set(rewards.map((r) => r.milestoneConvertedCount));
  return REFERRAL_MILESTONES.filter(
    (m) => convertedCount >= m.convertedCount && !present.has(m.convertedCount),
  );
}

/**
 * Care Credit balances. Earned is a promise the member has not claimed;
 * only claimed ("available") credit is spendable.
 */
export function computeCareCreditCents(rewards: RewardLike[]): {
  availableCreditCents: number;
  earnedCreditCents: number;
  hasAvailablePercentReward: boolean;
} {
  const credits = rewards.filter((r) => r.rewardType === "care_credit");
  return {
    availableCreditCents: credits
      .filter((r) => r.status === "available")
      .reduce((sum, r) => sum + (r.valueCents ?? 0), 0),
    earnedCreditCents: credits
      .filter((r) => r.status === "earned")
      .reduce((sum, r) => sum + (r.valueCents ?? 0), 0),
    hasAvailablePercentReward: rewards.some(
      (r) => r.rewardType === "percent_discount" && r.status === "available",
    ),
  };
}
