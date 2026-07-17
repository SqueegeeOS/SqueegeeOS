export type ReferralStatus =
  | "pending"
  | "converted"
  | "rewarded"
  | "expired"
  | "cancelled";

export interface ReferralActivityItem {
  id: string;
  leadName: string;
  status: ReferralStatus;
  createdAt: string;
  convertedAt: string | null;
}

export interface PortalReferralRewardItem {
  id: string;
  label: string;
  status: "earned" | "available" | "redeemed" | "expired";
  earnedAt: string;
}

export interface PortalReferralMilestonePreview {
  convertedCount: number;
  label: string;
  description: string;
  reached: boolean;
}

/** What the member sees in their portal. */
export interface MemberReferralSummary {
  code: string;
  /** Absolute link when origin is known, else root-relative. */
  link: string;
  visitCount: number;
  referralCount: number;
  convertedCount: number;
  /** Converted referrals not yet marked rewarded in HQ. */
  rewardEligibleCount: number;
  activity: ReferralActivityItem[];
  nextMilestone: PortalReferralMilestonePreview | null;
  rewards: PortalReferralRewardItem[];
  availableCareCreditLabel: string | null;
}

/** HQ row: one referring member with their referral totals. */
export interface HqReferralRow {
  code: string;
  memberName: string;
  membershipId: string;
  visitCount: number;
  convertedCount: number;
  nextMilestoneLabel: string | null;
  availableCareCreditLabel: string | null;
  availableRewardCount: number;
  /** Milestones reached without reward rows — issuance needs reconciliation. */
  rewardsOutOfSync: boolean;
  referrals: Array<{
    id: string;
    leadName: string;
    leadEmail: string;
    status: ReferralStatus;
    createdAt: string;
    convertedAt: string | null;
  }>;
}

export const REFERRAL_COOKIE = "sk_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export function referralPath(code: string): string {
  return `/r/${code}`;
}
