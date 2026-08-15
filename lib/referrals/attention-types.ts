const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;

export interface ReferralAttentionMember {
  membershipId: string;
  memberName: string;
  code: string;
  pendingReferralCount: number;
  oldestPendingAt: string | null;
  convertedUnrewardedCount: number;
  oldestConvertedAt: string | null;
  availableRewardCount: number;
  availableCareCreditCents: number;
}

export interface ReferralAttentionSnapshot {
  generatedAt: string;
  members: ReferralAttentionMember[];
  truncated: boolean;
}

export function referralMemberAnchorId(membershipId: string): string {
  const normalized = membershipId
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `referral-member-${normalized || "unknown"}`;
}
