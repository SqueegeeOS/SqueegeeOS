import "server-only";

import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldActor } from "./field-access";
import {
  isMissingTechnicianJobClockSchema,
  technicianJobClockState,
  validateTechnicianJobClockRequest,
  type TechnicianJobClockRequest,
  type TechnicianJobClockSnapshot,
} from "./technician-job-clock";

interface StoredTechnicianJobClockRow {
  appointment_id: string;
  started_at: string;
  ended_at: string | null;
  started_by_display_name: string;
  finished_by_display_name: string | null;
}

interface TechnicianJobClockRpcRow {
  entry_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | string | null;
  started_by_display_name: string;
  finished_by_display_name: string | null;
  replayed: boolean;
}

export interface RecordedTechnicianJobClockAction {
  entryId: string;
  clock: TechnicianJobClockSnapshot;
  replayed: boolean;
}

function finiteDurationSeconds(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function toSnapshot(
  row: Pick<
    StoredTechnicianJobClockRow,
    | "started_at"
    | "ended_at"
    | "started_by_display_name"
    | "finished_by_display_name"
  > & { duration_seconds?: number | string | null },
): TechnicianJobClockSnapshot {
  return {
    state: technicianJobClockState({
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: finiteDurationSeconds(row.duration_seconds ?? null),
    startedByDisplayName: row.started_by_display_name,
    finishedByDisplayName: row.finished_by_display_name,
  };
}

export async function loadTechnicianJobClockSnapshots(
  appointmentIds: string[],
): Promise<{
  available: boolean;
  byAppointmentId: Map<string, TechnicianJobClockSnapshot>;
}> {
  const uniqueAppointmentIds = [...new Set(appointmentIds)];
  const rows: StoredTechnicianJobClockRow[] = [];
  const supabase = createServiceRoleSupabaseClient();

  for (const appointmentIdChunk of chunkItems(uniqueAppointmentIds)) {
    const result = await supabase
      .from("technician_job_time_entries")
      .select(
        "appointment_id, started_at, ended_at, started_by_display_name, finished_by_display_name",
      )
      .in("appointment_id", appointmentIdChunk)
      .limit(2_000);
    if (result.error) {
      if (isMissingTechnicianJobClockSchema(result.error)) {
        return { available: false, byAppointmentId: new Map() };
      }
      throw new Error(result.error.message);
    }
    rows.push(...((result.data ?? []) as StoredTechnicianJobClockRow[]));
  }

  return {
    available: true,
    byAppointmentId: new Map(
      rows.map((row) => [row.appointment_id, toSnapshot(row)]),
    ),
  };
}

export async function recordTechnicianJobClockAction(input: {
  request: TechnicianJobClockRequest;
  actor: FieldActor;
}): Promise<RecordedTechnicianJobClockAction> {
  const validationError = validateTechnicianJobClockRequest(input.request);
  if (validationError) throw new Error(validationError);

  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("record_technician_job_clock_action", {
      p_action_id: input.request.actionId,
      p_property_id: input.request.propertyId,
      p_appointment_id: input.request.appointmentId,
      p_grant_id: input.actor.grantId,
      p_jobber_user_id: input.actor.jobberUserId,
      p_actor_display_name: input.actor.displayName,
      p_actor_kind: input.actor.kind === "technician" ? "technician" : "hq",
      p_action: input.request.action,
    })
    .single();

  if (result.error || !result.data) {
    if (isMissingTechnicianJobClockSchema(result.error)) {
      throw new Error("The technician job clock is not ready yet.");
    }
    throw new Error(result.error?.message ?? "Could not update the job clock.");
  }

  const row = result.data as TechnicianJobClockRpcRow;
  return {
    entryId: row.entry_id,
    clock: toSnapshot(row),
    replayed: Boolean(row.replayed),
  };
}
