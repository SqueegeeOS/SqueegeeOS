import "server-only";

import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  EMPTY_TECHNICIAN_JOB_CLOCK,
  technicianJobClockState,
  type TechnicianJobClockSnapshot,
} from "./technician-job-clock";
import {
  homeAtlasTechnicianIdentityKey,
  isMissingHomeAtlasFieldAssignmentSchema,
  type HomeAtlasFieldAssignmentSnapshot,
  type HomeAtlasFieldExecutionSnapshot,
} from "./homeatlas-field-assignment";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AssignmentRow {
  id: string;
  projection_id: string;
  external_visit_id: string;
  technician_id: string;
  technician_display_name: string;
  assigned_at: string;
}

interface ClockRow {
  assignment_id: string;
  started_at: string;
  ended_at: string | null;
  started_by_display_name: string;
  finished_by_display_name: string | null;
}

interface CloseoutRow {
  assignment_id: string;
  field_record_id: string;
  technician_display_name: string;
  customer_summary: string;
  internal_note: string;
  follow_up_needed: boolean;
  scope_exception: string;
  created_at: string;
}

export async function loadHomeAtlasFieldAssignments(externalVisitIds: string[]): Promise<{
  available: boolean;
  byExternalVisitId: Map<string, HomeAtlasFieldAssignmentSnapshot>;
}> {
  const ids = [...new Set(externalVisitIds.filter(Boolean))];
  const rows: AssignmentRow[] = [];
  const supabase = createServiceRoleSupabaseClient();
  for (const idChunk of chunkItems(ids)) {
    const result = await supabase
      .from("homeatlas_technician_visit_assignments")
      .select("id, projection_id, external_visit_id, technician_id, technician_display_name, assigned_at")
      .in("external_visit_id", idChunk);
    if (result.error) {
      if (isMissingHomeAtlasFieldAssignmentSchema(result.error)) {
        return { available: false, byExternalVisitId: new Map() };
      }
      throw new Error(result.error.message);
    }
    rows.push(...((result.data ?? []) as AssignmentRow[]));
  }
  return {
    available: true,
    byExternalVisitId: new Map(rows.map((row) => [row.external_visit_id, {
      id: row.id,
      projectionId: row.projection_id,
      externalVisitId: row.external_visit_id,
      technicianId: row.technician_id,
      technicianIdentityKey: homeAtlasTechnicianIdentityKey(row.technician_id),
      technicianDisplayName: row.technician_display_name,
      assignedAt: row.assigned_at,
    }])),
  };
}

function clockSnapshot(row: ClockRow | undefined): TechnicianJobClockSnapshot {
  if (!row) return EMPTY_TECHNICIAN_JOB_CLOCK;
  const startedAt = Date.parse(row.started_at);
  const endedAt = row.ended_at ? Date.parse(row.ended_at) : Number.NaN;
  const durationSeconds =
    Number.isFinite(startedAt) && Number.isFinite(endedAt)
      ? Math.max(0, Math.floor((endedAt - startedAt) / 1_000))
      : null;
  return {
    state: technicianJobClockState({ startedAt: row.started_at, endedAt: row.ended_at }),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds,
    startedByDisplayName: row.started_by_display_name,
    finishedByDisplayName: row.finished_by_display_name,
  };
}

export async function loadHomeAtlasFieldExecution(assignmentIds: string[]): Promise<{
  available: boolean;
  byAssignmentId: Map<string, HomeAtlasFieldExecutionSnapshot>;
}> {
  const ids = [...new Set(assignmentIds.filter(Boolean))];
  const empty = new Map<string, HomeAtlasFieldExecutionSnapshot>();
  if (!ids.length) return { available: true, byAssignmentId: empty };
  const supabase = createServiceRoleSupabaseClient();
  const [clockResult, closeoutResult] = await Promise.all([
    supabase.from("homeatlas_technician_job_clocks")
      .select("assignment_id, started_at, ended_at, started_by_display_name, finished_by_display_name")
      .in("assignment_id", ids),
    supabase.from("homeatlas_technician_job_closeouts")
      .select("assignment_id, field_record_id, technician_display_name, customer_summary, internal_note, follow_up_needed, scope_exception, created_at")
      .in("assignment_id", ids),
  ]);
  if (clockResult.error || closeoutResult.error) {
    const error = clockResult.error ?? closeoutResult.error;
    if (isMissingHomeAtlasFieldAssignmentSchema(error)) {
      return { available: false, byAssignmentId: empty };
    }
    throw new Error(error?.message ?? "Could not load technician execution evidence.");
  }
  const closeouts = (closeoutResult.data ?? []) as CloseoutRow[];
  const recordIds = closeouts.map((row) => row.field_record_id);
  const photoResult = recordIds.length
    ? await supabase.from("homeatlas_technician_job_photos")
        .select("field_record_id, customer_visible")
        .in("field_record_id", recordIds)
    : { data: [], error: null };
  if (photoResult.error) throw new Error(photoResult.error.message);
  const photos = new Map<string, { total: number; visible: number }>();
  for (const row of (photoResult.data ?? []) as Array<{field_record_id:string; customer_visible:boolean}>) {
    const current = photos.get(row.field_record_id) ?? { total: 0, visible: 0 };
    current.total += 1;
    if (row.customer_visible) current.visible += 1;
    photos.set(row.field_record_id, current);
  }
  const clocks = new Map(((clockResult.data ?? []) as ClockRow[]).map((row) => [row.assignment_id, row]));
  const closeoutByAssignment = new Map(closeouts.map((row) => [row.assignment_id, row]));
  for (const id of ids) {
    const closeout = closeoutByAssignment.get(id);
    const photo = closeout ? photos.get(closeout.field_record_id) : undefined;
    empty.set(id, {
      clock: clockSnapshot(clocks.get(id)),
      fieldRecordCount: closeout ? 1 : 0,
      latestFieldRecordAt: closeout?.created_at ?? null,
      latestFieldRecordBy: closeout?.technician_display_name ?? null,
      // Native closeouts live in private HQ tables, not the customer portal.
      customerVisibleRecordCount: 0,
      openFollowUpCount: closeout?.follow_up_needed ? 1 : 0,
      customerSummary: closeout?.customer_summary || null,
      internalNote: closeout?.internal_note || null,
      scopeException: closeout?.scope_exception || null,
      photoCount: photo?.total ?? 0,
    });
  }
  return { available: true, byAssignmentId: empty };
}

export async function assignHomeAtlasTechnicianVisit(input: {
  projectionId: string;
  technicianIdentityKey: string;
  expectedTechnicianIdentityKey: string | null;
  clientRequestId: string;
  actor?: string;
}) {
  const technicianId = input.technicianIdentityKey.startsWith("homeatlas:")
    ? input.technicianIdentityKey.slice("homeatlas:".length)
    : "";
  const expectedId = input.expectedTechnicianIdentityKey?.startsWith("homeatlas:")
    ? input.expectedTechnicianIdentityKey.slice("homeatlas:".length)
    : null;
  if (!UUID_PATTERN.test(input.projectionId) || !UUID_PATTERN.test(technicianId) ||
      !UUID_PATTERN.test(input.clientRequestId) || (expectedId && !UUID_PATTERN.test(expectedId))) {
    throw new Error("Choose a valid future visit and HomeAtlas technician.");
  }
  const result = await createServiceRoleSupabaseClient().rpc("assign_homeatlas_technician_visit", {
    p_client_request_id: input.clientRequestId,
    p_projection_id: input.projectionId,
    p_technician_id: technicianId,
    p_expected_technician_id: expectedId,
    p_actor: input.actor?.trim() || "HomeAtlas HQ",
  }).single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not assign this visit.");
  const row = result.data as {assignment_id:string; technician_id:string; technician_display_name:string; assigned_at:string; replayed:boolean};
  return {
    status: "assigned" as const,
    assignmentId: row.assignment_id,
    assignedUsers: [{ id: homeAtlasTechnicianIdentityKey(row.technician_id), name: row.technician_display_name }],
    confirmedAt: row.assigned_at,
    replayed: Boolean(row.replayed),
    source: "homeatlas" as const,
  };
}
