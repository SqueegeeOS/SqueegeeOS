import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  resolveSalesAttributionLifecycle,
  type SalesAttributionLifecycleStatus,
} from "./attribution-lifecycle";

interface MembershipLifecycleRow {
  id: string;
  homeowner_id: string;
  status: string;
}

interface AttributionLifecycleRow {
  id: string;
  rep_id: string;
  lead_id: string | null;
  membership_id: string;
  qualification_status: SalesAttributionLifecycleStatus;
  retention_qualifies_at: string | null;
  qualified_at: string | null;
}

export interface MembershipAttributionLifecycleResult {
  membershipId: string;
  attributionId: string | null;
  status:
    | SalesAttributionLifecycleStatus
    | "not_attributed";
  changed: boolean;
  leadMarkedWon: boolean;
}

export interface DueAttributionQualificationSummary {
  checked: number;
  qualified: number;
  cancelled: number;
  unchanged: number;
  failed: number;
}

/**
 * Idempotently mirrors one membership's authoritative lifecycle into its
 * salesperson attribution. This never creates attribution; signatures remain
 * the only source of a new salesperson credit.
 */
export async function syncMembershipSalesAttributionLifecycle(input: {
  supabase?: SupabaseClient;
  membershipId: string;
  referenceDate?: Date;
}): Promise<MembershipAttributionLifecycleResult> {
  const supabase =
    input.supabase ?? createPrivilegedServerSupabaseClient();
  const referenceDate = input.referenceDate ?? new Date();

  const [membershipResult, attributionResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, homeowner_id, status")
      .eq("id", input.membershipId)
      .maybeSingle(),
    supabase
      .from("sales_rep_attributions")
      .select(
        "id, rep_id, lead_id, membership_id, qualification_status, retention_qualifies_at, qualified_at",
      )
      .eq("membership_id", input.membershipId)
      .maybeSingle(),
  ]);

  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (attributionResult.error) throw new Error(attributionResult.error.message);
  if (!membershipResult.data) {
    throw new Error("Membership could not be verified for sales attribution.");
  }
  if (!attributionResult.data) {
    return {
      membershipId: input.membershipId,
      attributionId: null,
      status: "not_attributed",
      changed: false,
      leadMarkedWon: false,
    };
  }

  const membership = membershipResult.data as MembershipLifecycleRow;
  const attribution = attributionResult.data as AttributionLifecycleRow;
  const decision = resolveSalesAttributionLifecycle({
    membershipStatus: membership.status,
    currentStatus: attribution.qualification_status,
    retentionQualifiesAt: attribution.retention_qualifies_at,
    referenceDate,
  });
  const shouldSetQualifiedAt =
    decision.targetStatus === "qualified" && !attribution.qualified_at;
  const changed =
    decision.targetStatus !== attribution.qualification_status ||
    shouldSetQualifiedAt;

  if (changed) {
    const updateResult = await supabase
      .from("sales_rep_attributions")
      .update({
        qualification_status: decision.targetStatus,
        ...(shouldSetQualifiedAt
          ? { qualified_at: referenceDate.toISOString() }
          : {}),
      })
      .eq("id", attribution.id)
      .eq("membership_id", membership.id);
    if (updateResult.error) throw new Error(updateResult.error.message);
  }

  let leadMarkedWon = false;
  if (
    attribution.lead_id &&
    (decision.targetStatus === "active" ||
      decision.targetStatus === "qualified")
  ) {
    const leadResult = await supabase
      .from("sales_rep_leads")
      .update({
        status: "won",
        converted_homeowner_id: membership.homeowner_id,
        converted_membership_id: membership.id,
      })
      .eq("id", attribution.lead_id)
      .eq("rep_id", attribution.rep_id)
      .select("id")
      .maybeSingle();
    if (leadResult.error) throw new Error(leadResult.error.message);
    if (!leadResult.data) {
      throw new Error("Attributed sales lead could not be promoted to won.");
    }
    leadMarkedWon = true;
  }

  return {
    membershipId: membership.id,
    attributionId: attribution.id,
    status: decision.targetStatus,
    changed,
    leadMarkedWon,
  };
}

/** Daily reconciliation for David-style retention milestones and missed lifecycle updates. */
export async function qualifyDueSalesAttributions(input?: {
  referenceDate?: Date;
  limit?: number;
}): Promise<DueAttributionQualificationSummary> {
  const referenceDate = input?.referenceDate ?? new Date();
  const limit = Math.min(500, Math.max(1, Math.floor(input?.limit ?? 100)));
  const supabase = createPrivilegedServerSupabaseClient();
  const dueResult = await supabase
    .from("sales_rep_attributions")
    .select("membership_id")
    .in("qualification_status", ["pending", "active"])
    .not("membership_id", "is", null)
    .not("retention_qualifies_at", "is", null)
    .lte("retention_qualifies_at", referenceDate.toISOString())
    .limit(limit);
  if (dueResult.error) throw new Error(dueResult.error.message);

  const membershipIds = [
    ...new Set(
      (dueResult.data ?? [])
        .map((row) => row.membership_id as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const summary: DueAttributionQualificationSummary = {
    checked: membershipIds.length,
    qualified: 0,
    cancelled: 0,
    unchanged: 0,
    failed: 0,
  };

  // Keep the daily reconciliation gentle on Supabase while still completing
  // a meaningful batch inside the existing cron window.
  for (let offset = 0; offset < membershipIds.length; offset += 10) {
    const batch = membershipIds.slice(offset, offset + 10);
    const results = await Promise.allSettled(
      batch.map((membershipId) =>
        syncMembershipSalesAttributionLifecycle({
          supabase,
          membershipId,
          referenceDate,
        }),
      ),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        summary.failed += 1;
      } else if (result.value.status === "qualified" && result.value.changed) {
        summary.qualified += 1;
      } else if (result.value.status === "cancelled" && result.value.changed) {
        summary.cancelled += 1;
      } else {
        summary.unchanged += 1;
      }
    }
  }

  return summary;
}
