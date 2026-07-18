import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";

export type ClaimRewardOutcome =
  | "claimed"
  | "already_claimed"
  | "not_found"
  | "unclaimable"
  | "unavailable";

export interface ClaimRewardResult {
  outcome: ClaimRewardOutcome;
  rewardId: string | null;
  label: string | null;
  status: string | null;
  valueCents: number;
  claimedAt: string | null;
}

interface ClaimRow {
  outcome?: unknown;
  reward_id?: unknown;
  label?: unknown;
  status?: unknown;
  value_cents?: unknown;
  claimed_at?: unknown;
}

/** Map the claim function's jsonb payload into a typed result. Pure. */
export function mapClaimRow(row: ClaimRow | null): ClaimRewardResult {
  const outcome = row?.outcome;
  if (
    outcome !== "claimed" &&
    outcome !== "already_claimed" &&
    outcome !== "not_found" &&
    outcome !== "unclaimable"
  ) {
    return {
      outcome: "unavailable",
      rewardId: null,
      label: null,
      status: null,
      valueCents: 0,
      claimedAt: null,
    };
  }
  return {
    outcome,
    rewardId: typeof row?.reward_id === "string" ? row.reward_id : null,
    label: typeof row?.label === "string" ? row.label : null,
    status: typeof row?.status === "string" ? row.status : null,
    valueCents: typeof row?.value_cents === "number" ? row.value_cents : 0,
    claimedAt: typeof row?.claimed_at === "string" ? row.claimed_at : null,
  };
}

/**
 * Claim an earned referral reward for the membership resolved from the
 * portal token (the token itself never reaches this layer). Transactional
 * and idempotent in SQL: concurrent clicks and retries converge on one
 * 'claimed' event and one balance.
 */
export async function claimMemberReferralReward(input: {
  membershipId: string;
  rewardId: string;
  idempotencyKey: string;
}): Promise<ClaimRewardResult> {
  if (!isCloudPersistenceConnected()) return mapClaimRow(null);

  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase.rpc("claim_member_referral_reward", {
    p_reward_id: input.rewardId,
    p_membership_id: input.membershipId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    // Never leak DB details to callers; the route maps this to a 5xx.
    throw new Error("claim_failed");
  }

  return mapClaimRow((data ?? null) as ClaimRow | null);
}
