import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMembershipObligationWindows } from "./build-membership-obligation-windows";
import type {
  EnsureMembershipObligationsInput,
  EnsureMembershipObligationsResult,
} from "./types";

export async function ensureMembershipObligations(
  supabase: SupabaseClient,
  input: EnsureMembershipObligationsInput,
): Promise<EnsureMembershipObligationsResult> {
  const membershipYear = input.membershipYear ?? 1;
  const visitsPerYear = input.visitsPerYear;

  if (!visitsPerYear || visitsPerYear < 1) {
    return {
      created: 0,
      skipped: true,
      reason: "visits_per_year_missing",
    };
  }

  const { count, error: countError } = await supabase
    .from("obligations")
    .select("id", { count: "exact", head: true })
    .eq("membership_id", input.membershipId)
    .eq("membership_year", membershipYear);

  if (countError) {
    throw new Error(
      `Failed to check existing obligations: ${countError.message}`,
    );
  }

  if ((count ?? 0) > 0) {
    return { created: 0, skipped: true, reason: "already_generated" };
  }

  const windows = buildMembershipObligationWindows(
    visitsPerYear,
    input.startedAt,
    membershipYear,
  );

  if (windows.length === 0) {
    return {
      created: 0,
      skipped: true,
      reason: "no_windows_built",
    };
  }

  const rows = windows.map((window) => ({
    membership_id: input.membershipId,
    property_id: input.propertyId,
    homeowner_id: input.homeownerId,
    sequence: window.sequence,
    membership_year: window.membershipYear,
    target_window_start: window.targetWindowStart,
    target_window_end: window.targetWindowEnd,
    status: "promised",
    memory_status: "none",
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("obligations")
    .insert(rows)
    .select("id");

  if (insertError) {
    throw new Error(`Failed to create obligations: ${insertError.message}`);
  }

  const obligationIds = (inserted ?? []).map((row) => row.id as string);
  if (obligationIds.length > 0) {
    const events = obligationIds.map((obligationId) => ({
      obligation_id: obligationId,
      from_status: null,
      to_status: "promised",
      actor: "system",
      reason: "membership_activated",
      source: "system",
    }));

    const { error: eventError } = await supabase
      .from("obligation_events")
      .insert(events);

    if (eventError) {
      console.error(
        "[obligations] created rows but failed to log events:",
        eventError.message,
      );
    }
  }

  return { created: obligationIds.length, skipped: false };
}
