import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { getOrCreateReferralCode } from "./repository";

export interface ReferralCodeBackfillCandidate {
  membershipId: string;
  memberName: string;
}

export interface ReferralCodeBackfillResult {
  dryRun: boolean;
  eligibleActiveCount: number;
  alreadyCodedCount: number;
  missing: ReferralCodeBackfillCandidate[];
  issuedCount: number;
  failedCount: number;
}

/** Eligible = strictly active membership missing a referral code. Pure. */
export function partitionMissingCodes(
  eligible: ReferralCodeBackfillCandidate[],
  codedMembershipIds: Set<string>,
): ReferralCodeBackfillCandidate[] {
  return eligible.filter((m) => !codedMembershipIds.has(m.membershipId));
}

/**
 * Backfill referral codes for eligible active memberships that predate
 * activation-time issuance. Idempotent: existing codes are never replaced.
 * Dry-run reports the gap without writing anything.
 */
export async function backfillReferralCodes(options: {
  dryRun: boolean;
}): Promise<ReferralCodeBackfillResult> {
  const emptyResult: ReferralCodeBackfillResult = {
    dryRun: options.dryRun,
    eligibleActiveCount: 0,
    alreadyCodedCount: 0,
    missing: [],
    issuedCount: 0,
    failedCount: 0,
  };
  if (!isCloudPersistenceConnected()) return emptyResult;

  const supabase = createPrivilegedServerSupabaseClient();

  const memberships = await supabase
    .from("memberships")
    .select("id, homeowner_id, status, payment_setup_completed_at")
    .eq("status", "active")
    .not("payment_setup_completed_at", "is", null);
  if (memberships.error) throw new Error(memberships.error.message);

  const rows = memberships.data ?? [];
  const homeownerIds = [
    ...new Set(
      rows
        .map((r) => r.homeowner_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const homeowners = homeownerIds.length
    ? await supabase
        .from("homeowners")
        .select("id, full_name")
        .in("id", homeownerIds)
    : { data: [], error: null };
  if (homeowners.error) throw new Error(homeowners.error.message);

  const nameByHomeowner = new Map(
    (homeowners.data ?? []).map((h) => [
      h.id as string,
      ((h.full_name as string | null) ?? "").trim(),
    ]),
  );

  const eligible: ReferralCodeBackfillCandidate[] = rows.map((r) => ({
    membershipId: r.id as string,
    memberName: nameByHomeowner.get(r.homeowner_id as string) ?? "",
  }));

  const codes = await supabase.from("referral_codes").select("membership_id");
  if (codes.error) throw new Error(codes.error.message);
  const codedMembershipIds = new Set(
    (codes.data ?? []).map((c) => c.membership_id as string),
  );

  const missing = partitionMissingCodes(eligible, codedMembershipIds);
  const result: ReferralCodeBackfillResult = {
    dryRun: options.dryRun,
    eligibleActiveCount: eligible.length,
    alreadyCodedCount: eligible.length - missing.length,
    missing,
    issuedCount: 0,
    failedCount: 0,
  };

  if (options.dryRun) return result;

  for (const candidate of missing) {
    const code = await getOrCreateReferralCode(
      candidate.membershipId,
      candidate.memberName,
    );
    if (code) result.issuedCount += 1;
    else result.failedCount += 1;
  }

  return result;
}
