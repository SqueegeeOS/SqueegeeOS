import "server-only";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import type {
  HqReferralRow,
  MemberReferralSummary,
  ReferralActivityItem,
  ReferralStatus,
} from "./types";
import { referralPath } from "./types";
import { nextReferralMilestone } from "./milestones";
import {
  issueEarnedMilestoneRewards,
  loadMemberReferralRewards,
} from "./rewards";

/* Unambiguous alphabet: no 0/O/1/I/L. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "SK";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function supabaseOrNull() {
  if (!isCloudPersistenceConnected()) return null;
  try {
    return createPrivilegedServerSupabaseClient();
  } catch {
    return null;
  }
}

/** Get the member's referral code, creating it on first use. */
export async function getOrCreateReferralCode(
  membershipId: string,
  memberName: string,
): Promise<string | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const existing = await supabase
    .from("referral_codes")
    .select("code")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (existing.data?.code) return existing.data.code as string;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateCode();
    const inserted = await supabase
      .from("referral_codes")
      .insert({ membership_id: membershipId, member_name: memberName, code })
      .select("code")
      .maybeSingle();
    if (inserted.data?.code) return inserted.data.code as string;
    // unique-violation on code → retry; on membership_id → read it back
    const reread = await supabase
      .from("referral_codes")
      .select("code")
      .eq("membership_id", membershipId)
      .maybeSingle();
    if (reread.data?.code) return reread.data.code as string;
  }
  return null;
}

/** Log a landing on /r/[code]. Returns false for unknown/inactive codes. */
export async function recordReferralVisit(
  code: string,
  meta: { userAgent?: string | null; referer?: string | null },
): Promise<boolean> {
  const supabase = supabaseOrNull();
  if (!supabase) return false;

  const found = await supabase
    .from("referral_codes")
    .select("id, active")
    .eq("code", code)
    .maybeSingle();
  if (!found.data?.id || found.data.active === false) return false;

  await supabase.from("referral_visits").insert({
    referral_code_id: found.data.id,
    user_agent: meta.userAgent ?? null,
    referer: meta.referer ?? null,
  });
  return true;
}

/** Associate a freshly created lead with the referring member's code. */
export async function attachLeadToReferral(input: {
  code: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
}): Promise<void> {
  const supabase = supabaseOrNull();
  if (!supabase) return;

  const found = await supabase
    .from("referral_codes")
    .select("id, active")
    .eq("code", input.code)
    .maybeSingle();
  if (!found.data?.id || found.data.active === false) return;

  await supabase.from("referrals").insert({
    referral_code_id: found.data.id,
    lead_id: input.leadId,
    lead_name: input.leadName,
    lead_email: input.leadEmail.trim().toLowerCase(),
    status: "pending",
  });
}

/** Issue the member's referral code at membership activation. Idempotent. */
export async function issueReferralCodeForMembership(
  membershipId: string,
): Promise<string | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const membership = await supabase
    .from("memberships")
    .select("id, homeowner_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!membership.data?.id) return null;

  let memberName = "";
  if (membership.data.homeowner_id) {
    const homeowner = await supabase
      .from("homeowners")
      .select("full_name")
      .eq("id", membership.data.homeowner_id)
      .maybeSingle();
    memberName = (homeowner.data?.full_name as string | null) ?? "";
  }

  return getOrCreateReferralCode(membershipId, memberName);
}

/**
 * Mark a pending referral converted when the referred person signs, then
 * issue any newly reached 'earned' milestone rewards to the REFERRING member.
 * The conversion write stands even if issuance fails — the missing reward
 * surfaces as an HQ reconciliation warning (missingMilestones).
 */
export async function markReferralConverted(input: {
  email: string;
  membershipId: string;
}): Promise<void> {
  const supabase = supabaseOrNull();
  if (!supabase) return;

  const converted = await supabase
    .from("referrals")
    .update({
      status: "converted",
      converted_membership_id: input.membershipId,
      converted_at: new Date().toISOString(),
    })
    .eq("lead_email", input.email.trim().toLowerCase())
    .eq("status", "pending")
    .select("referral_code_id");

  const codeIds = [
    ...new Set(
      (converted.data ?? [])
        .map((r) => r.referral_code_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const codeId of codeIds) {
    try {
      const codeRow = await supabase
        .from("referral_codes")
        .select("membership_id")
        .eq("id", codeId)
        .maybeSingle();
      const referrerMembershipId = codeRow.data?.membership_id as
        | string
        | undefined;
      if (!referrerMembershipId) continue;

      const convertedRows = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referral_code_id", codeId)
        .in("status", ["converted", "rewarded"]);

      await issueEarnedMilestoneRewards(
        referrerMembershipId,
        convertedRows.count ?? 0,
      );
    } catch (error) {
      // Conversion is already durable; reward issuance is reconciled in HQ.
      console.error(
        "[referrals] earned-reward issuance failed; HQ reconciliation will flag it",
        { codeId, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }
}

interface ReferralRow {
  id: string;
  lead_name: string;
  lead_email: string;
  status: ReferralStatus;
  created_at: string;
  converted_at: string | null;
}

/**
 * Portal summary for one member. STRICTLY read-only — never creates codes
 * or rewards (issuance happens at activation/conversion; backfill covers
 * legacy members). Null when the member has no code yet.
 */
export async function getMemberReferralSummary(
  membershipId: string,
  _memberName: string,
  origin: string | null,
): Promise<MemberReferralSummary | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const codeRow = await supabase
    .from("referral_codes")
    .select("id, code")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (!codeRow.data?.id || !codeRow.data.code) return null;
  const code = codeRow.data.code as string;

  const [visits, referrals] = await Promise.all([
    supabase
      .from("referral_visits")
      .select("id", { count: "exact", head: true })
      .eq("referral_code_id", codeRow.data.id),
    supabase
      .from("referrals")
      .select("id, lead_name, lead_email, status, created_at, converted_at")
      .eq("referral_code_id", codeRow.data.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = (referrals.data ?? []) as ReferralRow[];
  const activity: ReferralActivityItem[] = rows.map((r) => ({
    id: r.id,
    leadName: r.lead_name || "A neighbor",
    status: r.status,
    createdAt: r.created_at,
    convertedAt: r.converted_at,
  }));
  const convertedCount = rows.filter(
    (r) => r.status === "converted" || r.status === "rewarded",
  ).length;

  const rewardsView = await loadMemberReferralRewards(membershipId, convertedCount);
  const nextMilestoneDef = nextReferralMilestone(convertedCount);

  return {
    code,
    link: origin ? `${origin}${referralPath(code)}` : referralPath(code),
    visitCount: visits.count ?? 0,
    referralCount: rows.length,
    convertedCount,
    rewardEligibleCount: rows.filter((r) => r.status === "converted").length,
    activity,
    nextMilestone: nextMilestoneDef
      ? {
          convertedCount: nextMilestoneDef.convertedCount,
          label: nextMilestoneDef.label,
          description: nextMilestoneDef.description,
          reached: convertedCount >= nextMilestoneDef.convertedCount,
        }
      : null,
    rewards: rewardsView.rewards.map((reward) => ({
      id: reward.id,
      label: reward.rewardLabel,
      status: reward.status,
      earnedAt: reward.earnedAt,
      valueCents: reward.valueCents,
    })),
    availableCareCreditLabel:
      rewardsView.availableCreditCents > 0
        ? `$${(rewardsView.availableCreditCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} in HomeAtlas Care Credits available`
        : null,
  };
}

/** HQ: every code with its referrals, most recent activity first. */
export async function listReferralsForHq(): Promise<HqReferralRow[]> {
  const supabase = supabaseOrNull();
  if (!supabase) return [];

  const codes = await supabase
    .from("referral_codes")
    .select("id, code, member_name, membership_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!codes.data?.length) return [];

  const ids = codes.data.map((c) => c.id as string);
  const [visits, referrals] = await Promise.all([
    supabase
      .from("referral_visits")
      .select("referral_code_id")
      .in("referral_code_id", ids),
    supabase
      .from("referrals")
      .select(
        "id, referral_code_id, lead_name, lead_email, status, created_at, converted_at",
      )
      .in("referral_code_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const visitCounts = new Map<string, number>();
  for (const v of visits.data ?? []) {
    const k = v.referral_code_id as string;
    visitCounts.set(k, (visitCounts.get(k) ?? 0) + 1);
  }

  return Promise.all(
    codes.data.map(async (c) => {
      const memberReferrals = ((referrals.data ?? []) as Array<
        ReferralRow & { referral_code_id: string }
      >).filter((r) => r.referral_code_id === c.id);
      const convertedCount = memberReferrals.filter(
        (r) => r.status === "converted" || r.status === "rewarded",
      ).length;

      const rewardsView = await loadMemberReferralRewards(
        c.membership_id as string,
        convertedCount,
      );
      const nextMilestone = nextReferralMilestone(convertedCount);

      return {
        code: c.code as string,
        memberName: (c.member_name as string) || "Member",
        membershipId: c.membership_id as string,
        visitCount: visitCounts.get(c.id as string) ?? 0,
        convertedCount,
        nextMilestoneLabel: nextMilestone?.label ?? null,
        availableCareCreditLabel:
          rewardsView.availableCreditCents > 0
            ? `$${(rewardsView.availableCreditCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} Care Credit available`
            : null,
        availableRewardCount: rewardsView.rewards.filter(
          (r) => r.status === "available" || r.status === "earned",
        ).length,
        rewardsOutOfSync: rewardsView.missingMilestones.length > 0,
        referrals: memberReferrals.map((r) => ({
          id: r.id,
          leadName: r.lead_name,
          leadEmail: r.lead_email,
          status: r.status,
          createdAt: r.created_at,
          convertedAt: r.converted_at,
        })),
      };
    }),
  );
}
