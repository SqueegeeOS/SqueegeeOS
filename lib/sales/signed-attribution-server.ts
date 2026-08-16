import "server-only";

import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  annualRateToCents,
  membershipStatusToAttributionStatus,
  type SalesAttributionStatus,
} from "./attribution-rules";

type CompensationPlan = "founding_david" | "standard_commission";

interface PresentationLineageRow {
  id: string;
  sales_rep_id: string | null;
  sales_rep_lead_id: string | null;
}

interface MembershipCloseRow {
  id: string;
  presentation_id: string | null;
  agreement_id: string | null;
  annual_rate: number | string | null;
  status: string;
  started_at: string | null;
  created_at: string;
}

interface RepPlanRow {
  id: string;
  compensation_plan: CompensationPlan;
}

interface SignedAgreementAttributionRow {
  id: string;
  membership_id: string | null;
  presentation_id: string | null;
  status: string;
  signed_at: string;
}

interface AttributionRow {
  id: string;
  rep_id: string;
  lead_id: string | null;
  membership_id: string;
  presentation_id: string | null;
  signed_agreement_id: string | null;
  attributed_arr_cents: number;
  qualification_status: SalesAttributionStatus;
  compensation_plan_snapshot: CompensationPlan;
  attribution_source: "agreement_signature" | "legacy_backfill";
  attributed_at: string;
}

interface ReconciliationPresentationRow {
  id: string;
  membership_id: string | null;
  agreement_id: string | null;
  signed_at: string | null;
  updated_at: string;
}

interface ReconciliationMembershipRow {
  id: string;
  presentation_id: string | null;
  agreement_id: string | null;
}

export interface SignedMembershipAttributionResult {
  status: "not_rep_attributed" | "created" | "already_recorded";
  attributionId: string | null;
  attributedArrCents: number;
}

export interface SignedAttributionReconciliationResult {
  inspected: number;
  repaired: number;
  failed: number;
  remaining: number;
}

export interface SignedAttributionFleetReconciliationResult
  extends SignedAttributionReconciliationResult {
  activeReps: number;
  failedReps: number;
}

function addUtcMonths(value: string, months: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Membership start time is invalid for sales attribution.");
  }
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const finalDay = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      finalDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  ).toISOString();
}

/**
 * Idempotently credits one membership to the representative whose stable ID
 * was attached to the originating presentation. All money and plan fields are
 * re-read from the database after the agreement succeeds.
 */
export async function recordSignedMembershipAttribution(input: {
  presentationId: string;
  membershipId: string;
  agreementId?: string | null;
  signedAt?: string | null;
}): Promise<SignedMembershipAttributionResult> {
  const supabase = createPrivilegedServerSupabaseClient();
  const [presentationResult, membershipResult] = await Promise.all([
    supabase
      .from("presentations")
      .select("id, sales_rep_id, sales_rep_lead_id")
      .eq("id", input.presentationId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select(
        "id, presentation_id, agreement_id, annual_rate, status, started_at, created_at",
      )
      .eq("id", input.membershipId)
      .maybeSingle(),
  ]);

  if (presentationResult.error) {
    throw new Error(presentationResult.error.message);
  }
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!presentationResult.data || !membershipResult.data) {
    throw new Error(
      "Signed membership attribution source could not be verified.",
    );
  }

  const presentation = presentationResult.data as PresentationLineageRow;
  const membership = membershipResult.data as MembershipCloseRow;
  if (!presentation.sales_rep_id) {
    return {
      status: "not_rep_attributed",
      attributionId: null,
      attributedArrCents: 0,
    };
  }
  if (membership.presentation_id !== presentation.id) {
    throw new Error("Signed membership does not belong to its presentation.");
  }
  if (
    membership.agreement_id &&
    input.agreementId &&
    membership.agreement_id !== input.agreementId
  ) {
    throw new Error("Signed agreement does not belong to its membership.");
  }
  const agreementId = membership.agreement_id ?? input.agreementId;
  if (!agreementId) {
    throw new Error("Signed membership has no agreement reference.");
  }

  const { data: repData, error: repError } = await supabase
    .from("sales_reps")
    .select("id, compensation_plan")
    .eq("id", presentation.sales_rep_id)
    .maybeSingle();
  if (repError) throw new Error(repError.message);
  if (!repData) throw new Error("Presentation salesperson no longer exists.");

  const rep = repData as RepPlanRow;
  const { data: agreementData, error: agreementError } = await supabase
    .from("signed_agreements")
    .select("id, membership_id, presentation_id, status, signed_at")
    .eq("id", agreementId)
    .maybeSingle();
  if (agreementError) throw new Error(agreementError.message);
  if (!agreementData) {
    throw new Error("Signed agreement could not be verified for attribution.");
  }
  const agreement = agreementData as SignedAgreementAttributionRow;
  if (
    agreement.status !== "complete" ||
    agreement.membership_id !== membership.id ||
    agreement.presentation_id !== presentation.id
  ) {
    throw new Error("Agreement signature lineage is invalid for attribution.");
  }

  const attributedArrCents = annualRateToCents(membership.annual_rate);
  const attributedAt = agreement.signed_at;
  const membershipStartedAt =
    membership.started_at ?? agreement.signed_at ?? input.signedAt ?? membership.created_at;
  const qualificationStatus = membershipStatusToAttributionStatus(
    membership.status,
  );
  const retentionQualifiesAt =
    rep.compensation_plan === "founding_david"
      ? addUtcMonths(membershipStartedAt, 12)
      : null;

  const insertResult = await supabase
    .from("sales_rep_attributions")
    .insert({
      rep_id: rep.id,
      lead_id: presentation.sales_rep_lead_id,
      membership_id: membership.id,
      presentation_id: presentation.id,
      signed_agreement_id: agreementId,
      attributed_arr_cents: attributedArrCents,
      qualification_status: qualificationStatus,
      membership_started_at: membershipStartedAt,
      retention_qualifies_at: retentionQualifiesAt,
      compensation_plan_snapshot: rep.compensation_plan,
      attribution_source: "agreement_signature",
      attributed_at: attributedAt,
    })
    .select(
      "id, rep_id, lead_id, membership_id, presentation_id, signed_agreement_id, attributed_arr_cents, qualification_status, compensation_plan_snapshot, attribution_source, attributed_at",
    )
    .maybeSingle();
  // 048 intentionally used a partial unique membership index. A plain insert
  // plus 23505 handling works both before and after this migration and avoids
  // PostgREST's predicate-less ON CONFLICT inference trap.
  if (insertResult.error && insertResult.error.code !== "23505") {
    throw new Error(insertResult.error.message);
  }

  const attributionResult = insertResult.data
    ? insertResult
    : await supabase
        .from("sales_rep_attributions")
        .select(
          "id, rep_id, lead_id, membership_id, presentation_id, signed_agreement_id, attributed_arr_cents, qualification_status, compensation_plan_snapshot, attribution_source, attributed_at",
        )
        .eq("membership_id", membership.id)
        .maybeSingle();
  if (attributionResult.error || !attributionResult.data) {
    throw new Error(
      attributionResult.error?.message ?? "Sales attribution was not recorded.",
    );
  }

  const attribution = attributionResult.data as AttributionRow;
  if (
    attribution.rep_id !== rep.id ||
    attribution.membership_id !== membership.id ||
    attribution.presentation_id !== presentation.id ||
    attribution.signed_agreement_id !== agreementId ||
    Number(attribution.attributed_arr_cents) !== attributedArrCents ||
    attribution.compensation_plan_snapshot !== rep.compensation_plan ||
    attribution.lead_id !== presentation.sales_rep_lead_id ||
    new Date(attribution.attributed_at).getTime() !==
      new Date(attributedAt).getTime() ||
    !["agreement_signature", "legacy_backfill"].includes(
      attribution.attribution_source,
    )
  ) {
    throw new Error(
      "Membership already has conflicting salesperson attribution details.",
    );
  }

  if (presentation.sales_rep_lead_id) {
    const leadUpdate = await supabase
      .from("sales_rep_leads")
      .update({
        status: "signed",
        converted_membership_id: membership.id,
        next_follow_up_at: null,
      })
      .eq("id", presentation.sales_rep_lead_id)
      .eq("rep_id", rep.id);
    if (leadUpdate.error) {
      console.error(
        "[sales-attribution] linked lead status update failed",
        leadUpdate.error.message,
      );
    }
  }

  return {
    status: insertResult.data ? "created" : "already_recorded",
    attributionId: attribution.id,
    attributedArrCents: Number(attribution.attributed_arr_cents) || 0,
  };
}

/**
 * Bounded repair path for a successful signature whose non-fatal reporting
 * write failed. It is safe under concurrent workspace loads because membership
 * attribution is unique and recordSignedMembershipAttribution verifies retries.
 */
export async function reconcileSignedMembershipAttributionsForRep(
  repId: string,
  repairLimit = 5,
): Promise<SignedAttributionReconciliationResult> {
  const boundedRepairLimit = Math.max(
    1,
    Math.min(10, Math.floor(repairLimit)),
  );
  const scanLimit = Math.min(100, Math.max(20, boundedRepairLimit * 20));
  const supabase = createPrivilegedServerSupabaseClient();
  const presentationsResult = await supabase
    .from("presentations")
    .select("id, membership_id, agreement_id, signed_at, updated_at")
    .eq("sales_rep_id", repId)
    .eq("status", "signed")
    .order("updated_at", { ascending: false })
    .limit(scanLimit);
  if (presentationsResult.error) {
    throw new Error(presentationsResult.error.message);
  }

  const presentations = (presentationsResult.data ??
    []) as ReconciliationPresentationRow[];
  const presentationIds = presentations.map((presentation) => presentation.id);
  if (presentationIds.length === 0) {
    return { inspected: 0, repaired: 0, failed: 0, remaining: 0 };
  }
  const linkedMembershipsResult = await supabase
    .from("memberships")
    .select("id, presentation_id, agreement_id")
    .in("presentation_id", presentationIds);
  if (linkedMembershipsResult.error) {
    throw new Error(linkedMembershipsResult.error.message);
  }
  const membershipsByPresentation = new Map<
    string,
    ReconciliationMembershipRow[]
  >();
  for (const membership of (linkedMembershipsResult.data ??
    []) as ReconciliationMembershipRow[]) {
    if (!membership.presentation_id) continue;
    const current = membershipsByPresentation.get(membership.presentation_id) ?? [];
    current.push(membership);
    membershipsByPresentation.set(membership.presentation_id, current);
  }

  const resolved = presentations.flatMap((presentation) => {
    if (presentation.membership_id) {
      const linked = membershipsByPresentation
        .get(presentation.id)
        ?.find((membership) => membership.id === presentation.membership_id);
      return linked ? [{ presentation, membership: linked }] : [];
    }
    const candidates = membershipsByPresentation.get(presentation.id) ?? [];
    return candidates.length === 1
      ? [{ presentation, membership: candidates[0] }]
      : [];
  });
  const unresolved = presentations.length - resolved.length;
  const membershipIds = resolved.map(({ membership }) => membership.id);
  if (membershipIds.length === 0) {
    return {
      inspected: presentations.length,
      repaired: 0,
      failed: 0,
      remaining: unresolved,
    };
  }

  const existingResult = await supabase
    .from("sales_rep_attributions")
    .select("membership_id")
    .in("membership_id", membershipIds);
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existingMembershipIds = new Set(
    (existingResult.data ?? []).map((row) => String(row.membership_id)),
  );
  const missing = resolved.filter(
    ({ membership }) => !existingMembershipIds.has(membership.id),
  );

  let repaired = 0;
  let failed = 0;
  let cleared = 0;
  for (const { presentation, membership } of missing.slice(
    0,
    boundedRepairLimit,
  )) {
    try {
      const result = await recordSignedMembershipAttribution({
        presentationId: presentation.id,
        membershipId: membership.id,
        agreementId: presentation.agreement_id ?? membership.agreement_id,
        signedAt: presentation.signed_at,
      });
      if (result.status === "created") repaired += 1;
      if (result.status !== "not_rep_attributed") cleared += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[sales-attribution] reconciliation item failed",
        presentation.id,
        error,
      );
    }
  }

  return {
    inspected: presentations.length,
    repaired,
    failed,
    remaining: unresolved + Math.max(0, missing.length - cleared),
  };
}

/**
 * Bounded system repair for signature-time attribution writes that were
 * deliberately non-blocking. This makes attribution eventual even when an
 * owner never opens a representative workspace after a close.
 */
export async function reconcileSignedMembershipAttributionsForActiveReps(
  repairLimitPerRep = 5,
  repScanLimit = 25,
): Promise<SignedAttributionFleetReconciliationResult> {
  const boundedRepLimit = Math.max(1, Math.min(25, Math.floor(repScanLimit)));
  const supabase = createPrivilegedServerSupabaseClient();
  const repsResult = await supabase
    .from("sales_reps")
    .select("id", { count: "exact" })
    .eq("status", "active")
    .order("id", { ascending: true })
    .range(0, boundedRepLimit - 1);
  if (repsResult.error) throw new Error(repsResult.error.message);
  if (repsResult.count === null) {
    throw new Error("HomeAtlas could not prove active salesperson coverage.");
  }
  const reps = (repsResult.data ?? []) as Array<{ id: string }>;
  if (repsResult.count > reps.length) {
    throw new Error(
      "Active salesperson attribution repair exceeded its coverage limit.",
    );
  }

  const summary: SignedAttributionFleetReconciliationResult = {
    activeReps: reps.length,
    failedReps: 0,
    inspected: 0,
    repaired: 0,
    failed: 0,
    remaining: 0,
  };
  for (const rep of reps) {
    try {
      const result = await reconcileSignedMembershipAttributionsForRep(
        rep.id,
        repairLimitPerRep,
      );
      summary.inspected += result.inspected;
      summary.repaired += result.repaired;
      summary.failed += result.failed;
      summary.remaining += result.remaining;
    } catch (error) {
      summary.failedReps += 1;
      console.error("[sales-attribution] active rep reconciliation failed", {
        repId: rep.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return summary;
}
