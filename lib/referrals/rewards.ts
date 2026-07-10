import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
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
  redeemedAt: string | null;
}

export interface MemberReferralRewardsView {
  convertedCount: number;
  nextMilestone: ReferralMilestoneDefinition | null;
  rewards: MemberReferralRewardRecord[];
  availableCreditCents: number;
  hasAvailablePercentReward: boolean;
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
    redeemedAt: row.redeemed_at,
  };
}

function isMissingTableError(message: string, table: string): boolean {
  return message.includes("does not exist") && message.includes(table);
}

/**
 * Ensure milestone reward rows exist for each converted-referral threshold reached.
 * v1: one row per milestone, status available until manually redeemed in HQ later.
 */
export async function syncReferralMilestoneRewards(
  membershipId: string,
  convertedCount: number,
): Promise<void> {
  if (!isCloudPersistenceConnected()) return;

  const supabase = createServerSupabaseClient();
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
        status: "available",
        earned_at: new Date().toISOString(),
      },
      { onConflict: "membership_id,milestone_converted_count", ignoreDuplicates: true },
    );

    if (error && !isMissingTableError(error.message, "member_referral_rewards")) {
      throw new Error(error.message);
    }
  }
}

export async function loadMemberReferralRewards(
  membershipId: string,
  convertedCount: number,
): Promise<MemberReferralRewardsView> {
  await syncReferralMilestoneRewards(membershipId, convertedCount);

  const empty: MemberReferralRewardsView = {
    convertedCount,
    nextMilestone: nextReferralMilestone(convertedCount),
    rewards: [],
    availableCreditCents: 0,
    hasAvailablePercentReward: false,
  };

  if (!isCloudPersistenceConnected()) {
    return empty;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("member_referral_rewards")
    .select(
      "id, membership_id, milestone_converted_count, reward_type, reward_label, value_cents, value_percent, status, earned_at, redeemed_at",
    )
    .eq("membership_id", membershipId)
    .order("milestone_converted_count", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message, "member_referral_rewards")) {
      return empty;
    }
    throw new Error(error.message);
  }

  const rewards = ((data ?? []) as RewardRow[]).map(mapRewardRow);
  const availableCreditCents = rewards
    .filter(
      (r) =>
        r.rewardType === "care_credit" &&
        (r.status === "available" || r.status === "earned"),
    )
    .reduce((sum, r) => sum + (r.valueCents ?? 0), 0);
  const hasAvailablePercentReward = rewards.some(
    (r) =>
      r.rewardType === "percent_discount" &&
      (r.status === "available" || r.status === "earned"),
  );

  return {
    convertedCount,
    nextMilestone: nextReferralMilestone(convertedCount),
    rewards,
    availableCreditCents,
    hasAvailablePercentReward,
  };
}
