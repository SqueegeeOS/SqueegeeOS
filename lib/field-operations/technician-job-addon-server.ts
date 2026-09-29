import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { homeAtlasTechnicianId, type TechnicianFieldActor } from "./field-access";
import { assertTechnicianAssignedToFieldAssignment } from "./field-scope";
import type { TechnicianJobAddonReport } from "./technician-job-addon";

interface AddonRow {
  id: string;
  client_request_id: string;
  assignment_id: string;
  technician_id: string;
  reported_by_access_grant_id: string;
  service_name: string;
  reported_amount_cents: number;
  reported_at: string;
  voided_at: string | null;
}

function toView(row: AddonRow): TechnicianJobAddonReport {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    serviceName: row.service_name,
    reportedAmountCents: row.reported_amount_cents,
    reportedAt: row.reported_at,
    voidedAt: row.voided_at,
  };
}

export async function listTechnicianJobAddons(actor: TechnicianFieldActor, assignmentId: string) {
  await assertTechnicianAssignedToFieldAssignment(actor, assignmentId);
  const technicianId = homeAtlasTechnicianId(actor.jobberUserId);
  if (!technicianId) throw new Error("This job needs a HomeAtlas technician assignment.");
  const result = await createServiceRoleSupabaseClient()
    .from("homeatlas_technician_job_addon_reports")
    .select("id, client_request_id, assignment_id, technician_id, reported_by_access_grant_id, service_name, reported_amount_cents, reported_at, voided_at")
    .eq("assignment_id", assignmentId)
    .eq("technician_id", technicianId)
    .order("reported_at", { ascending: false })
    .limit(50);
  if (result.error) throw new Error("Add-on log is unavailable. HQ may need to finish its setup.");
  return ((result.data ?? []) as AddonRow[]).map(toView);
}

export async function recordTechnicianJobAddon(
  actor: TechnicianFieldActor,
  input: { clientRequestId: string; assignmentId: string; serviceName: string; reportedAmountCents: number },
): Promise<{ report: TechnicianJobAddonReport; replayed: boolean }> {
  await assertTechnicianAssignedToFieldAssignment(actor, input.assignmentId);
  const technicianId = homeAtlasTechnicianId(actor.jobberUserId);
  if (!technicianId) throw new Error("This job needs a HomeAtlas technician assignment.");
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.from("homeatlas_technician_job_addon_reports")
    .insert({
      client_request_id: input.clientRequestId,
      assignment_id: input.assignmentId,
      technician_id: technicianId,
      technician_display_name: actor.displayName,
      service_name: input.serviceName,
      reported_amount_cents: input.reportedAmountCents,
      reported_by_access_grant_id: actor.grantId,
    })
    .select("id, client_request_id, assignment_id, technician_id, reported_by_access_grant_id, service_name, reported_amount_cents, reported_at, voided_at")
    .single();
  if (!result.error && result.data) return { report: toView(result.data as AddonRow), replayed: false };

  if (result.error?.code === "23505") {
    const existing = await supabase.from("homeatlas_technician_job_addon_reports")
      .select("id, client_request_id, assignment_id, technician_id, reported_by_access_grant_id, service_name, reported_amount_cents, reported_at, voided_at")
      .eq("client_request_id", input.clientRequestId).maybeSingle();
    const row = existing.data as AddonRow | null;
    if (row && row.assignment_id === input.assignmentId && row.technician_id === technicianId &&
        row.reported_by_access_grant_id === actor.grantId && row.service_name === input.serviceName &&
        row.reported_amount_cents === input.reportedAmountCents) {
      return { report: toView(row), replayed: true };
    }
    throw new Error("This add-on request was already used for a different entry.");
  }
  throw new Error("Could not save the add-on report. Please try again.");
}
