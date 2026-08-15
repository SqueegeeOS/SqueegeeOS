import "server-only";

import { randomUUID } from "node:crypto";
import { formatBusinessCalendarDate } from "@/lib/admin/company-business-timezone";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { readJobberTodayVisitAssignment } from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  resolveVerifiedProductionDuration,
  validateFieldIndependenceReviewInput,
  type FieldDurationSource,
  type FieldIndependenceReview,
  type FieldJobClass,
  type FieldQualityOutcome,
  type OwnerInvolvement,
  type RecordFieldIndependenceReviewInput,
} from "./independence-review";

interface FieldIndependenceReviewRow {
  id: string;
  appointment_id: string;
  property_id: string;
  external_visit_id: string;
  service_date: string;
  technician_jobber_user_id: string;
  technician_display_name: string;
  job_class: FieldJobClass;
  owner_involvement: OwnerInvolvement;
  owner_minutes: number;
  quality_outcome: FieldQualityOutcome;
  production_minutes: number | null;
  duration_source: FieldDurationSource;
  source_verified_at: string | null;
  reviewed_by: string;
  review_note: string | null;
  reviewed_at: string;
}

interface AppointmentRow {
  id: string;
  property_id: string;
  provider: string | null;
  external_id: string | null;
  verification_state: string | null;
  match_state: string | null;
}

interface VisitProjectionRow {
  external_visit_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  is_complete: boolean;
  raw_payload: unknown;
  source_observed_at: string | null;
}

interface VisitEventRow {
  event_type: string;
  occurred_at: string;
}

function toReview(row: FieldIndependenceReviewRow): FieldIndependenceReview {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    propertyId: row.property_id,
    externalVisitId: row.external_visit_id,
    serviceDate: row.service_date,
    technicianJobberUserId: row.technician_jobber_user_id,
    technicianDisplayName: row.technician_display_name,
    jobClass: row.job_class,
    ownerInvolvement: row.owner_involvement,
    ownerMinutes: Number(row.owner_minutes),
    qualityOutcome: row.quality_outcome,
    productionMinutes:
      row.production_minutes == null ? null : Number(row.production_minutes),
    durationSource: row.duration_source,
    sourceVerifiedAt: row.source_verified_at,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
  };
}

export function isMissingFieldIndependenceReviewSchema(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    (message.includes("field_independence_reviews") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

export async function loadFieldIndependenceReviews(
  appointmentIds: string[],
): Promise<{
  available: boolean;
  byAppointmentId: Map<string, FieldIndependenceReview>;
}> {
  const byAppointmentId = new Map<string, FieldIndependenceReview>();
  if (appointmentIds.length === 0) {
    return { available: true, byAppointmentId };
  }

  const result = await createServiceRoleSupabaseClient()
    .from("field_independence_reviews")
    .select(
      "id, appointment_id, property_id, external_visit_id, service_date, technician_jobber_user_id, technician_display_name, job_class, owner_involvement, owner_minutes, quality_outcome, production_minutes, duration_source, source_verified_at, reviewed_by, review_note, reviewed_at",
    )
    .in("appointment_id", [...new Set(appointmentIds)])
    .limit(1_000);

  if (result.error) {
    if (isMissingFieldIndependenceReviewSchema(result.error)) {
      return { available: false, byAppointmentId };
    }
    throw new Error(result.error.message);
  }

  for (const row of (result.data ?? []) as FieldIndependenceReviewRow[]) {
    const review = toReview(row);
    byAppointmentId.set(review.appointmentId, review);
  }
  return { available: true, byAppointmentId };
}

export async function recordFieldIndependenceReview(
  input: RecordFieldIndependenceReviewInput,
): Promise<FieldIndependenceReview> {
  const validationError = validateFieldIndependenceReviewInput(input);
  if (validationError) throw new Error(validationError);

  const supabase = createServiceRoleSupabaseClient();
  const appointmentResult = await supabase
    .from("member_appointments")
    .select(
      "id, property_id, provider, external_id, verification_state, match_state",
    )
    .eq("id", input.appointmentId)
    .maybeSingle();
  if (appointmentResult.error || !appointmentResult.data) {
    throw new Error("HomeAtlas appointment was not found.");
  }
  const appointment = appointmentResult.data as AppointmentRow;
  if (
    appointment.property_id !== input.propertyId ||
    appointment.provider !== "jobber" ||
    !appointment.external_id ||
    appointment.verification_state !== "verified" ||
    appointment.match_state !== "matched"
  ) {
    throw new Error("This is not the verified Jobber appointment for that home.");
  }

  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select(
      "external_visit_id, scheduled_start, scheduled_end, is_complete, raw_payload, source_observed_at",
    )
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_visit_id", appointment.external_id)
    .maybeSingle();
  if (projectionResult.error || !projectionResult.data) {
    throw new Error("Refresh Jobber before reviewing technician independence.");
  }
  const projection = projectionResult.data as VisitProjectionRow;
  if (!projection.is_complete || !projection.scheduled_start) {
    throw new Error("Only a completed Jobber visit can receive this review.");
  }

  const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
  if (assignment.assignmentReadState !== "available") {
    throw new Error("Jobber crew assignment is not currently verifiable.");
  }
  const technician = assignment.assignedUsers.find(
    (candidate) => candidate.id === input.technicianJobberUserId,
  );
  if (!technician) {
    throw new Error("Choose a technician assigned to this visit in Jobber.");
  }

  const fieldRecordResult = await supabase
    .from("property_assessments")
    .select("id, follow_up_status")
    .eq("visit_id", input.appointmentId)
    .not("field_record_id", "is", null)
    .limit(200);
  if (fieldRecordResult.error) {
    throw new Error("Visit proof is unavailable. Apply field-record migration 054.");
  }
  const fieldRecords = (fieldRecordResult.data ?? []) as Array<{
    id: string;
    follow_up_status: string | null;
  }>;
  if (fieldRecords.length === 0) {
    throw new Error("Save the HomeAtlas visit closeout before reviewing the job.");
  }
  if (
    input.qualityOutcome === "verified" &&
    fieldRecords.some((record) => record.follow_up_status === "open")
  ) {
    throw new Error("Resolve the open field follow-up before verifying quality.");
  }

  let serviceStartedAt: string | null = null;
  let serviceCompletedAt: string | null = null;
  const eventResult = await supabase
    .from("technician_visit_events")
    .select("event_type, occurred_at")
    .eq("appointment_id", input.appointmentId)
    .in("event_type", ["service_started", "service_completed"])
    .order("occurred_at", { ascending: true });
  if (!eventResult.error) {
    for (const event of (eventResult.data ?? []) as VisitEventRow[]) {
      if (event.event_type === "service_started" && !serviceStartedAt) {
        serviceStartedAt = event.occurred_at;
      }
      if (event.event_type === "service_completed") {
        serviceCompletedAt = event.occurred_at;
      }
    }
  }

  const duration = resolveVerifiedProductionDuration({
    serviceStartedAt,
    serviceCompletedAt,
    scheduledStart: projection.scheduled_start,
    scheduledEnd: projection.scheduled_end,
  });
  const existingResult = await supabase
    .from("field_independence_reviews")
    .select("id")
    .eq("appointment_id", input.appointmentId)
    .maybeSingle();
  if (existingResult.error && !isMissingFieldIndependenceReviewSchema(existingResult.error)) {
    throw new Error(existingResult.error.message);
  }

  const reviewedAt = new Date().toISOString();
  const saved = await supabase
    .from("field_independence_reviews")
    .upsert(
      {
        id: (existingResult.data as { id?: string } | null)?.id ?? randomUUID(),
        appointment_id: input.appointmentId,
        property_id: input.propertyId,
        external_visit_id: projection.external_visit_id,
        service_date: formatBusinessCalendarDate(
          new Date(projection.scheduled_start),
        ),
        technician_jobber_user_id: technician.id,
        technician_display_name: technician.name,
        job_class: input.jobClass,
        owner_involvement: input.ownerInvolvement,
        owner_minutes: input.ownerMinutes,
        quality_outcome: input.qualityOutcome,
        production_minutes: duration.minutes,
        duration_source: duration.source,
        source_verified_at: projection.source_observed_at,
        reviewed_by: "HomeAtlas HQ",
        review_note: input.reviewNote?.trim() || null,
        reviewed_at: reviewedAt,
      },
      { onConflict: "appointment_id" },
    )
    .select(
      "id, appointment_id, property_id, external_visit_id, service_date, technician_jobber_user_id, technician_display_name, job_class, owner_involvement, owner_minutes, quality_outcome, production_minutes, duration_source, source_verified_at, reviewed_by, review_note, reviewed_at",
    )
    .single();
  if (saved.error || !saved.data) {
    if (isMissingFieldIndependenceReviewSchema(saved.error)) {
      throw new Error("Apply HomeAtlas migration 061 before recording reviews.");
    }
    throw new Error(saved.error?.message ?? "Could not save the field review.");
  }
  return toReview(saved.data as FieldIndependenceReviewRow);
}
