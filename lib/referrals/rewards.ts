import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createPrivilegedServerSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/persistence/supabase/client";
import {
  computeCareCreditCents,
  milestonesMissingRewards,
  nextReferralMilestone,
  REFERRAL_MILESTONES,
  type ReferralMilestoneDefinition,
} from "./milestones";
import type { ReferralRewardStatus, ReferralRewardType } from "./milestones";

export interface MemberReferralRewardRecord {
  id: string;
  milestoneConvertedCount: number;
  rewardType: ReferralRewardType;
  rewardLabel: string;
  valueCents: number | null;
  valuePercent: number | null;
  status: ReferralRewardStatus;
  earnedAt: string;
  /** Null until claimed — and until migration 036 adds the column. */
  claimedAt: string | null;
  redeemedAt: string | null;
}

export interface MemberReferralRewardsView {
  convertedCount: number;
  nextMilestone: ReferralMilestoneDefinition | null;
  rewards: MemberReferralRewardRecord[];
  /** Claimed, spendable Care Credit only. */
  availableCreditCents: number;
  /** Earned but not yet claimed — a promise, not a balance. */
  earnedCreditCents: number;
  hasAvailablePercentReward: boolean;
  /** Milestones reached with no reward row — issuance needs HQ reconciliation. */
  missingMilestones: ReferralMilestoneDefinition[];
}

interface RewardRow {
  id: string;
  membership_id: string;
  milestone_converted_count: number;
  reward_type: ReferralRewardType;
  reward_label: string;
  value_cents: number | null;
  value_percent: number | null;
  status: ReferralRewardStatus;
  earned_at: string;
  claimed_at?: string | null;
  redeemed_at: string | null;
}

function mapRewardRow(row: RewardRow): MemberReferralRewardRecord {
  return {
    id: row.id,
    milestoneConvertedCount: row.milestone_converted_count,
    rewardType: row.reward_type,
    rewardLabel: row.reward_label,
    valueCents: row.value_cents,
    valuePercent: row.value_percent,
    status: row.status,
    earnedAt: row.earned_at,
    claimedAt: row.claimed_at ?? null,
    redeemedAt: row.redeemed_at,
  };
}

function isMissingTableError(message: string, table: string): boolean {
  return message.includes("does not exist") && message.includes(table);
}

/**
 * Issue 'earned' milestone reward rows for each converted-referral threshold
 * reached. Called ONLY from conversion events and explicit backfill — never
 * from read paths. Existing rows are never touched (ignoreDuplicates), so a
 * claimed or redeemed reward can never regress to earned.
 */
export async function issueEarnedMilestoneRewards(
  membershipId: string,
  convertedCount: number,
): Promise<void> {
  if (!isCloudPersistenceConnected()) return;

  const supabase = createPrivilegedServerSupabaseClient();
  const earnedMilestones = REFERRAL_MILESTONES.filter(
    (m) => convertedCount >= m.convertedCount,
  );

  for (const milestone of earnedMilestones) {
    const { error } = await supabase.from("member_referral_rewards").upsert(
      {
        membership_id: membershipId,
        milestone_converted_count: milestone.convertedCount,
        reward_type: milestone.rewardType,
        reward_label: milestone.label,
        value_cents: milestone.valueCents,
        value_percent: milestone.valuePercent,
        status: "earned",
        earned_at: new Date().toISOString(),
      },
      { onConflict: "membership_id,milestone_converted_count", ignoreDuplicates: true },
    );

    if (error && !isMissingTableError(error.message, "member_referral_rewards")) {
      throw new Error(error.message);
    }
  }
}

/** Claimed, spendable Care Credit balance for one membership. Read-only. */
export async function getAvailableCareCreditCents(
  membershipId: string,
): Promise<number> {
  if (!isCloudPersistenceConnected()) return 0;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("member_referral_rewards")
    .select("reward_type, status, value_cents, milestone_converted_count")
    .eq("membership_id", membershipId);

  if (error) {
    if (isMissingTableError(error.message, "member_referral_rewards")) return 0;
    throw new Error(error.message);
  }

  return computeCareCreditCents(
    ((data ?? []) as Array<{
      reward_type: ReferralRewardType;
      status: ReferralRewardStatus;
      value_cents: number | null;
      milestone_converted_count: number;
    }>).map((row) => ({
      milestoneConvertedCount: row.milestone_converted_count,
      rewardType: row.reward_type,
      status: row.status,
      valueCents: row.value_cents,
    })),
  ).availableCreditCents;
}

/** Read-only rewards view. Never creates or mutates rows. */
export async function loadMemberReferralRewards(
  membershipId: string,
  convertedCount: number,
): Promise<MemberReferralRewardsView> {
  const empty: MemberReferralRewardsView = {
    convertedCount,
    nextMilestone: nextReferralMilestone(convertedCount),
    rewards: [],
    availableCreditCents: 0,
    earnedCreditCents: 0,
    hasAvailablePercentReward: false,
    missingMilestones: milestonesMissingRewards(convertedCount, []),
  };

  if (!isCloudPersistenceConnected()) {
    return empty;
  }

  const supabase = createServerSupabaseClient();
  // select("*") keeps this read valid before AND after migration 036 adds
  // claimed_at; the mapper treats the column as optional.
  const { data, error } = await supabase
    .from("member_referral_rewards")
    .select("*")
    .eq("membership_id", membershipId)
    .order("milestone_converted_count", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message, "member_referral_rewards")) {
      return empty;
    }
    throw new Error(error.message);
  }

  const rewards = ((data ?? []) as RewardRow[]).map(mapRewardRow);
  const credit = computeCareCreditCents(rewards);

  return {
    convertedCount,
    nextMilestone: nextReferralMilestone(convertedCount),
    rewards,
    availableCreditCents: credit.availableCreditCents,
    earnedCreditCents: credit.earnedCreditCents,
    hasAvailablePercentReward: credit.hasAvailablePercentReward,
    missingMilestones: milestonesMissingRewards(convertedCount, rewards),
  };
}
