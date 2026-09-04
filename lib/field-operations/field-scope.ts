import "server-only";

import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { loadJobberTodayBoard } from "@/lib/care-operations/jobber-today";
import {
  readJobberTodayVisitAssignment,
  summarizeJobberTodayVisits,
  type JobberTodayData,
  type JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldActor, TechnicianFieldActor } from "./field-access";

export const FIELD_WRITE_PAST_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
export const FIELD_WRITE_FUTURE_WINDOW_MS = 2 * 24 * 60 * 60 * 1_000;

interface AppointmentAssignmentRow {
  property_id: string;
  provider: string | null;
  external_id: string | null;
}

interface ProjectionAssignmentRow {
  scheduled_start: string | null;
  raw_payload: unknown;
}

export function isVisitAssignedToTechnician(
  visit: Pick<
    JobberTodayVisit,
    | "assignedUsers"
    | "assignmentReadState"
    | "homeAtlasAssignedTechnicianId"
  >,
  jobberUserId: string,
): boolean {
  return (
    visit.homeAtlasAssignedTechnicianId === jobberUserId ||
    (visit.assignmentReadState === "available" &&
      visit.assignedUsers.some((user) => user.id === jobberUserId))
  );
}

export function isFieldWriteTimeAllowed(
  scheduledStart: string | null,
  now = new Date(),
): boolean {
  if (!scheduledStart) return false;
  const scheduledAt = new Date(scheduledStart).getTime();
  if (!Number.isFinite(scheduledAt)) return false;
  return (
    scheduledAt >= now.getTime() - FIELD_WRITE_PAST_WINDOW_MS &&
    scheduledAt <= now.getTime() + FIELD_WRITE_FUTURE_WINDOW_MS
  );
}

export function scopeTodayBoardToTechnician(
  board: JobberTodayData,
  jobberUserId: string,
): JobberTodayData {
  const visits = board.visits
    .filter((visit) => isVisitAssignedToTechnician(visit, jobberUserId))
    .map((visit) => ({
      ...visit,
      // Portal paths contain bearer access and HQ follow-up records can contain
      // private owner notes. Neither belongs in a technician DTO.
      jobberPropertyWebUri: null,
      jobberClientWebUri: null,
      homeAtlasMembershipId: null,
      homeAtlasPortalPath: null,
    }));
  return {
    ...board,
    visits,
    summary: summarizeJobberTodayVisits(visits),
    fieldFollowUps: [],
  };
}

export async function loadFieldTodayBoard(
  actor: FieldActor,
): Promise<JobberTodayData> {
  const board = await loadJobberTodayBoard();
  return actor.kind === "admin"
    ? board
    : scopeTodayBoardToTechnician(board, actor.jobberUserId);
}

export async function listFieldActorPropertyIds(
  actor: FieldActor,
): Promise<string[] | null> {
  if (actor.kind === "admin") return null;
  let board: JobberTodayData;
  try {
    board = await loadFieldTodayBoard(actor);
  } catch {
    return [];
  }
  return [
    ...new Set(
      board.visits.flatMap((visit) =>
        visit.homeAtlasPropertyId ? [visit.homeAtlasPropertyId] : [],
      ),
    ),
  ];
}

export async function canFieldActorAccessProperty(
  actor: FieldActor,
  propertyId: string,
): Promise<boolean> {
  if (actor.kind === "admin") return true;
  const propertyIds = await listFieldActorPropertyIds(actor);
  return propertyIds?.includes(propertyId) ?? false;
}

export async function assertTechnicianAssignedToAppointment(
  actor: TechnicianFieldActor,
  propertyId: string,
  appointmentId: string,
  now = new Date(),
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const appointmentResult = await supabase
    .from("member_appointments")
    .select("property_id, provider, external_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentResult.error || !appointmentResult.data) {
    throw new Error("The HomeAtlas appointment is not available to this Field Pass.");
  }

  const appointment = appointmentResult.data as AppointmentAssignmentRow;
  if (
    appointment.property_id !== propertyId ||
    appointment.provider !== "jobber" ||
    !appointment.external_id
  ) {
    throw new Error("The appointment is not a verified Jobber stop for this home.");
  }

  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select("scheduled_start, raw_payload")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_visit_id", appointment.external_id)
    .maybeSingle();
  if (projectionResult.error || !projectionResult.data) {
    throw new Error("Refresh Jobber before documenting this stop.");
  }

  const projection = projectionResult.data as ProjectionAssignmentRow;
  const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
  if (
    assignment.assignmentReadState !== "available" ||
    !assignment.assignedUsers.some((user) => user.id === actor.jobberUserId)
  ) {
    throw new Error("This Jobber stop is not assigned to this Field Pass.");
  }
  if (!isFieldWriteTimeAllowed(projection.scheduled_start, now)) {
    throw new Error(
      "This stop is outside the safe field-closeout window. Ask HQ to document it.",
    );
  }
}

export async function assertTechnicianAssignedToFieldAssignment(
  actor: FieldActor,
  assignmentId: string,
  now = new Date(),
): Promise<void> {
  if (actor.kind === "admin") return;
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select("id, technician_id, technician_display_name, jobber_visit_projections!inner(scheduled_start, is_complete, visit_status)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (result.error || !result.data) {
    throw new Error("This HomeAtlas assignment is not available to this Field Pass.");
  }
  const row = result.data as unknown as {
    technician_id: string;
    technician_display_name: string;
    jobber_visit_projections:
      | {
          scheduled_start: string | null;
          is_complete: boolean;
          visit_status: string;
        }
      | Array<{
          scheduled_start: string | null;
          is_complete: boolean;
          visit_status: string;
        }>;
  };
  if (
    actor.jobberUserId !== `homeatlas:${row.technician_id}` ||
    actor.displayName !== row.technician_display_name
  ) {
    throw new Error("This Jobber stop is not assigned to this Field Pass.");
  }
  const projection = Array.isArray(row.jobber_visit_projections)
    ? row.jobber_visit_projections[0]
    : row.jobber_visit_projections;
  if (!projection) {
    throw new Error("This HomeAtlas assignment no longer has a Jobber stop.");
  }
  if (projection.is_complete || projection.visit_status === "REMOVED") {
    throw new Error("This Jobber stop is no longer active.");
  }
  if (!isFieldWriteTimeAllowed(projection.scheduled_start, now)) {
    throw new Error(
      "This stop is outside the safe field-closeout window. Ask HQ to document it.",
    );
  }
}

export async function assertFieldActorCanWriteAppointment(
  actor: FieldActor,
  propertyId: string,
  appointmentId: string,
): Promise<void> {
  if (actor.kind === "admin") return;
  await assertTechnicianAssignedToAppointment(
    actor,
    propertyId,
    appointmentId,
  );
}
