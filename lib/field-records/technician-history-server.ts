import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { loadHomeAtlasFieldExecution } from "@/lib/field-operations/homeatlas-field-assignment-server";
import { ownerDispatchMonthUtcBounds } from "@/lib/field-operations/owner-dispatch";
import { HISTORY_PAGE_SIZE, parseHistoryCursor, type TechnicianHistoryPage } from "./technician-history";

export async function loadTechnicianHistory(month: string, cursor: string | null): Promise<TechnicianHistoryPage> {
  const { startUtc, endUtc } = ownerDispatchMonthUtcBounds(month);
  const before = parseHistoryCursor(cursor);
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase.from("homeatlas_technician_job_clocks")
    .select("id, assignment_id, started_at")
    .gte("started_at", startUtc.toISOString()).lt("started_at", endUtc.toISOString())
    .order("started_at", { ascending: false }).order("id", { ascending: false })
    .limit(HISTORY_PAGE_SIZE + 1);
  if (before) query = query.or(`started_at.lt.${before.startedAt},and(started_at.eq.${before.startedAt},id.lt.${before.id})`);
  const clocks = await query;
  if (clocks.error) throw new Error("History lookup failed");
  const rows = (clocks.data ?? []).slice(0, HISTORY_PAGE_SIZE);
  if (!rows.length) return { month, items: [], nextCursor: null };
  const ids = rows.map(row => row.assignment_id);
  const [assignments, execution] = await Promise.all([
    supabase.from("homeatlas_technician_visit_assignments")
      .select("id, projection_id, technician_display_name").in("id", ids),
    loadHomeAtlasFieldExecution(ids),
  ]);
  if (assignments.error || !execution.available) throw new Error("History details unavailable");
  const byAssignment = new Map((assignments.data ?? []).map(row => [row.id, row]));
  const projections = await supabase.from("jobber_visit_projections")
    .select("id, client_name, title, is_complete, visit_status, visit_invoice_status, source_observed_at")
    .in("id", [...new Set((assignments.data ?? []).map(row => row.projection_id))]);
  if (projections.error) throw new Error("Visit source unavailable");
  const byProjection = new Map((projections.data ?? []).map(row => [row.id, row]));
  const items = rows.map(row => {
    const assignment = byAssignment.get(row.assignment_id);
    const record = execution.byAssignmentId.get(row.assignment_id);
    if (!assignment || !record || record.clock.state === "not_started") throw new Error("Incomplete history snapshot");
    const visit = byProjection.get(assignment.projection_id);
    // Explicit DTO: do not send raw provider payloads, access grants, internal
    // notes or signed media URLs until the owner opens the private review.
    return {
      assignmentId: row.assignment_id,
      clientName: visit?.client_name || "Source customer unavailable",
      service: visit?.title || "Technician visit",
      technicianName: record.latestFieldRecordBy || assignment.technician_display_name,
      clock: record.clock,
      hasCloseout: record.fieldRecordCount > 0,
      openFollowUp: record.openFollowUpCount > 0,
      photoCount: record.photoCount,
      jobberComplete: visit?.is_complete ?? null,
      jobberStatus: visit?.visit_status ?? null,
      invoiceStatus: visit?.visit_invoice_status ?? null,
      sourceObservedAt: visit?.source_observed_at ?? null,
    };
  });
  const last = rows[rows.length - 1];
  return { month, items, nextCursor: clocks.data!.length > HISTORY_PAGE_SIZE ? `${last.started_at}|${last.id}` : null };
}
