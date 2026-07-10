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
