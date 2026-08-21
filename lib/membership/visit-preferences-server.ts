import "server-only";

import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  type MembershipVisitPreference,
  validatePreferredVisitMonths,
} from "@/lib/membership/visit-preferences";

interface VisitPreferenceRow {
  id: string;
  membership_id: string;
  visit_sequence: number;
  preferred_month: number | null;
  timing_note: string | null;
  service_summary: string | null;
  visit_price: number | string | null;
  customer_editable_month: boolean;
}

function isMissingTable(message: string): boolean {
  return (
    message.includes("membership_visit_preferences") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function mapRow(row: VisitPreferenceRow): MembershipVisitPreference {
  return {
    id: row.id,
    membershipId: row.membership_id,
    sequence: row.visit_sequence,
    preferredMonth: row.preferred_month,
    timingNote: row.timing_note,
    serviceSummary: row.service_summary,
    visitPrice: row.visit_price == null ? null : Number(row.visit_price),
    customerEditableMonth: row.customer_editable_month,
  };
}

export async function loadMembershipVisitPreferences(
  membershipId: string,
): Promise<MembershipVisitPreference[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase
    .from("membership_visit_preferences")
    .select(
      "id, membership_id, visit_sequence, preferred_month, timing_note, service_summary, visit_price, customer_editable_month",
    )
    .eq("membership_id", membershipId)
    .order("visit_sequence", { ascending: true });

  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as VisitPreferenceRow[]).map(mapRow);
}

export async function saveMembershipPreferredMonths(input: {
  membershipId: string;
  months: unknown;
  updatedBy: "customer_portal" | "hq";
}): Promise<MembershipVisitPreference[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, visits_per_year")
    .eq("id", input.membershipId)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership) throw new Error("Membership not found");

  const expectedCount = Number(membership.visits_per_year ?? 0);
  if (expectedCount < 1 || expectedCount > 12) {
    throw new Error("Membership cadence is not configured");
  }

  const months = validatePreferredVisitMonths(input.months, expectedCount);
  if (!months) {
    throw new Error(
      `Choose ${expectedCount} different preferred months for this membership`,
    );
  }

  if (input.updatedBy === "customer_portal") {
    const existing = await loadMembershipVisitPreferences(input.membershipId);
    if (existing.some((preference) => !preference.customerEditableMonth)) {
      throw new Error("These scheduling preferences are managed by your care team");
    }
  }

  const rows = months.map((preferredMonth, index) => ({
    membership_id: input.membershipId,
    visit_sequence: index + 1,
    preferred_month: preferredMonth,
    updated_by: input.updatedBy,
  }));

  const { error } = await supabase
    .from("membership_visit_preferences")
    .upsert(rows, { onConflict: "membership_id,visit_sequence" });

  if (error) throw new Error(error.message);
  return loadMembershipVisitPreferences(input.membershipId);
}
