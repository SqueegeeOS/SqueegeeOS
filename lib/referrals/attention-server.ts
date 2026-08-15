import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import type {
  ReferralAttentionMember,
  ReferralAttentionSnapshot,
} from "./attention-types";

interface ReferralCodeAttentionRow {
  id: string;
  code: string;
  member_name: string;
  membership_id: string;
}

interface ReferralAttentionRow {
  referral_code_id: string;
  status: "pending" | "converted" | "rewarded" | "expired" | "cancelled";
  created_at: string;
  converted_at: string | null;
}

interface ReferralRewardAttentionRow {
  membership_id: string;
  reward_type: string;
  value_cents: number | null;
  status: string;
}

function oldestIso(values: string[]): string | null {
  return values.reduce<string | null>(
    (oldest, value) => (!oldest || value < oldest ? value : oldest),
    null,
  );
}

/** Read-only projection for HQ. It deliberately never syncs or creates rewards. */
export async function loadReferralAttentionSnapshot(
  reference = new Date(),
): Promise<ReferralAttentionSnapshot> {
  if (!isCloudPersistenceConnected()) {
    throw new Error("Cloud persistence is not connected.");
  }
  const supabase = createPrivilegedServerSupabaseClient();
  const codeResult = await supabase
    .from("referral_codes")
    .select("id, code, member_name, membership_id")
    .order("created_at", { ascending: false })
    .limit(101);
  if (codeResult.error) throw new Error(codeResult.error.message);

  const returnedCodes = (codeResult.data ?? []) as ReferralCodeAttentionRow[];
  const truncated = returnedCodes.length > 100;
  const codes = returnedCodes.slice(0, 100);
  if (codes.length === 0) {
    return { generatedAt: reference.toISOString(), members: [], truncated };
  }

  const codeIds = codes.map((code) => code.id);
  const membershipIds = [...new Set(codes.map((code) => code.membership_id))];
  const [referralResult, rewardResult] = await Promise.all([
    supabase
      .from("referrals")
      .select("referral_code_id, status, created_at, converted_at")
      .in("referral_code_id", codeIds),
    supabase
      .from("member_referral_rewards")
      .select("membership_id, reward_type, value_cents, status")
      .in("membership_id", membershipIds),
  ]);
  if (referralResult.error) throw new Error(referralResult.error.message);
  if (rewardResult.error) throw new Error(rewardResult.error.message);

  const referrals = (referralResult.data ?? []) as ReferralAttentionRow[];
  const rewards = (rewardResult.data ?? []) as ReferralRewardAttentionRow[];
  const members: ReferralAttentionMember[] = codes.map((code) => {
    const memberReferrals = referrals.filter(
      (referral) => referral.referral_code_id === code.id,
    );
    const pending = memberReferrals.filter(
      (referral) => referral.status === "pending",
    );
    const converted = memberReferrals.filter(
      (referral) => referral.status === "converted",
    );
    const memberRewards = rewards.filter(
      (reward) =>
        reward.membership_id === code.membership_id &&
        (reward.status === "available" || reward.status === "earned"),
    );
    return {
      membershipId: code.membership_id,
      memberName: code.member_name?.trim() || "HomeAtlas member",
      code: code.code,
      pendingReferralCount: pending.length,
      oldestPendingAt: oldestIso(pending.map((referral) => referral.created_at)),
      convertedUnrewardedCount: converted.length,
      oldestConvertedAt: oldestIso(
        converted.map(
          (referral) => referral.converted_at ?? referral.created_at,
        ),
      ),
      availableRewardCount: memberRewards.length,
      availableCareCreditCents: memberRewards
        .filter((reward) => reward.reward_type === "care_credit")
        .reduce((sum, reward) => sum + Math.max(0, reward.value_cents ?? 0), 0),
    };
  });

  return { generatedAt: reference.toISOString(), members, truncated };
}
