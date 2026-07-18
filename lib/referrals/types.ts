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
  /** Cents for care-credit rewards; null for percent rewards. */
  valueCents: number | null;
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

/** One reward in the HQ lifecycle view. */
export interface HqReferralRewardItem {
  id: string;
  label: string;
  status: "earned" | "available" | "redeemed" | "expired";
  earnedAt: string;
  claimedAt: string | null;
  valueCents: number | null;
}

/** One immutable claim-ledger event in the HQ view. */
export interface HqReferralRewardEvent {
  id: string;
  rewardId: string;
  eventType: string;
  amountCents: number;
  actorType: string;
  createdAt: string;
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
  /** Reached milestones missing reward rows, by label. */
  missingMilestoneLabels: string[];
  /** Full reward lifecycle, oldest milestone first. */
  rewards: HqReferralRewardItem[];
  /** Immutable claim-ledger events, newest first (empty pre-036). */
  claimEvents: HqReferralRewardEvent[];
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
