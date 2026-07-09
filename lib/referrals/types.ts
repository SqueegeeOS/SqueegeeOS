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

/** What the member sees in their portal. */
export interface MemberReferralSummary {
  code: string;
  /** Absolute link when origin is known, else root-relative. */
  link: string;
  visitCount: number;
  referralCount: number;
  convertedCount: number;
  /** v1 policy: every converted referral earns one reward credit. */
  rewardEligibleCount: number;
  activity: ReferralActivityItem[];
}

/** HQ row: one referring member with their referral totals. */
export interface HqReferralRow {
  code: string;
  memberName: string;
  membershipId: string;
  visitCount: number;
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
