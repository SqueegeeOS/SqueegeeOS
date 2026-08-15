import "server-only";

import {
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  isJobberTodayDataStale,
  readJobberTodayVisitAssignment,
} from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  fieldReviewCountsAsBoughtBackTime,
  type FieldIndependenceReview,
} from "./independence-review";
import {
  isMissingFieldIndependenceReviewSchema,
  loadFieldIndependenceReviews,
} from "./independence-review-server";
import { listTechnicianAccessRoster } from "./field-access";
import { resolveTechnicianFieldPassState } from "./technician-dispatch";
import {
  deriveIndependentDayOutcome,
  deriveTechnicianReadiness,
  validateIndependentDayCancellation,
  validateIndependentDayPlanInput,
  validateTechnicianCompetencyInput,
  type IndependentDayTrial,
  type IndependentDayTrialStatus,
  type PlanIndependentDayInput,
  type RecordTechnicianCompetencyInput,
  type TechnicianCompetencyAssessment,
  type TechnicianCompetencyId,
  type TechnicianCompetencyRating,
  type TechnicianReadinessSnapshot,
} from "./technician-readiness";

interface CompetencyAssessmentRow {
  id: string;
  jobber_user_id: string;
  display_name: string;
  competency: TechnicianCompetencyId;
  rating: TechnicianCompetencyRating;
  evidence_note: string;
  source_appointment_id: string | null;
  assessed_by: string;
  assessed_at: string;
}

interface IndependentDayTrialRow {
  id: string;
  jobber_user_id: string;
  display_name: string;
  trial_date: string;
  status: IndependentDayTrialStatus;
  plan_note: string | null;
  planned_by: string;
  planned_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

interface TrialVisitProjectionRow {
  external_visit_id: string;
  scheduled_start: string;
  is_complete: boolean;
  raw_payload: unknown;
}

interface AssessmentAppointmentRow {
  provider: string | null;
  external_id: string | null;
  verification_state: string | null;
  match_state: string | null;
}

interface AssessmentProjectionRow {
  is_complete: boolean;
  raw_payload: unknown;
}

const ASSESSMENT_SELECT =
  "id, jobber_user_id, display_name, competency, rating, evidence_note, source_appointment_id, assessed_by, assessed_at";
const TRIAL_SELECT =
  "id, jobber_user_id, display_name, trial_date, status, plan_note, planned_by, planned_at, cancelled_at, cancelled_by, cancellation_reason";

function toAssessment(
  row: CompetencyAssessmentRow,
): TechnicianCompetencyAssessment {
  return {
    id: row.id,
    jobberUserId: row.jobber_user_id,
    displayName: row.display_name,
    competency: row.competency,
    rating: row.rating,
    evidenceNote: row.evidence_note,
    sourceAppointmentId: row.source_appointment_id,
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at,
  };
}

export function isMissingTechnicianReadinessSchema(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    ((message.includes("technician_competency_assessments") ||
      message.includes("technician_independent_day_trials")) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}

async function loadOpenExceptions(
  appointmentIds: string[],
): Promise<{ appointmentIds: Set<string>; warning: string | null }> {
  const ids = [...new Set(appointmentIds)];
  const appointmentIdSet = new Set<string>();
  if (ids.length === 0) return { appointmentIds: appointmentIdSet, warning: null };
  const supabase = createServiceRoleSupabaseClient();
  const [fieldFollowUps, serviceCases] = await Promise.all([
    supabase
      .from("property_assessments")
      .select("visit_id")
      .in("visit_id", ids)
      .eq("follow_up_status", "open")
      .limit(5_000),
    supabase
      .from("customer_service_cases")
      .select("appointment_id")
      .in("appointment_id", ids)
      .in("status", ["open", "acknowledged"])
      .limit(5_000),
  ]);
  if (fieldFollowUps.error || serviceCases.error) {
    return {
      appointmentIds: appointmentIdSet,
      warning:
        "Open field and customer exceptions could not be verified, so affected independence evidence is not counted.",
    };
  }
  for (const row of fieldFollowUps.data ?? []) {
    if (typeof row.visit_id === "string") appointmentIdSet.add(row.visit_id);
  }
  for (const row of serviceCases.data ?? []) {
    if (typeof row.appointment_id === "string") {
      appointmentIdSet.add(row.appointment_id);
    }
  }
  return { appointmentIds: appointmentIdSet, warning: null };
}

function missingSchemaSnapshot(input: {
  reference: Date;
  jobberConnected: boolean;
  jobberStatus: string;
  roster: Awaited<ReturnType<typeof listTechnicianAccessRoster>>;
}): TechnicianReadinessSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    today: formatBusinessCalendarDate(input.reference),
    schemaAvailable: false,
    jobberConnected: input.jobberConnected,
    jobberStatus: input.jobberStatus,
    jobberDataFresh: false,
    lastJobberSyncAt: null,
    technicians: input.roster.crew.map((member) =>
      deriveTechnicianReadiness({
        jobberUserId: member.jobberUserId,
        displayName: member.displayName,
        mirroredRosterActive: true,
        fieldPassState: resolveTechnicianFieldPassState(
          member.currentGrant,
          input.reference,
        ),
        assessments: [],
        independentJobs: 0,
        independentMinutes: 0,
        ownerInterventionJobs: 0,
        qualityExceptionJobs: 0,
        lastIndependentServiceDate: null,
      }),
    ),
    trials: [],
    warnings: [
      "Apply migrations 061 and 062 before trusting technician readiness or planning an independent day.",
    ],
  };
}

function reviewByTechnician(
  reviews: FieldIndependenceReview[],
): Map<string, FieldIndependenceReview[]> {
  const result = new Map<string, FieldIndependenceReview[]>();
  for (const review of reviews) {
    const existing = result.get(review.technicianJobberUserId) ?? [];
    existing.push(review);
    result.set(review.technicianJobberUserId, existing);
  }
  return result;
}

export async function loadTechnicianReadinessSnapshot(
  reference: Date = new Date(),
): Promise<TechnicianReadinessSnapshot> {
  const supabase = createServiceRoleSupabaseClient();
  const today = formatBusinessCalendarDate(reference);
  const [roster, connection] = await Promise.all([
    listTechnicianAccessRoster(),
    readJobberConnectionStatus(),
  ]);
  const historyStart = shiftCalendarDate(today, -180);
  const [assessmentResult, trialResult, reviewIdResult, latestSyncResult] =
    await Promise.all([
      supabase
        .from("technician_competency_assessments")
        .select(ASSESSMENT_SELECT)
        .order("assessed_at", { ascending: false })
        .limit(5_000),
      supabase
        .from("technician_independent_day_trials")
        .select(TRIAL_SELECT)
        .gte("trial_date", historyStart)
        .order("trial_date", { ascending: false })
        .order("planned_at", { ascending: false })
        .limit(500),
      supabase
        .from("field_independence_reviews")
        .select("appointment_id")
        .gte("service_date", historyStart)
        .limit(5_000),
      supabase
        .from("jobber_visit_projections")
        .select("source_observed_at")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .order("source_observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (
    isMissingTechnicianReadinessSchema(assessmentResult.error) ||
    isMissingTechnicianReadinessSchema(trialResult.error) ||
    isMissingFieldIndependenceReviewSchema(reviewIdResult.error)
  ) {
    return missingSchemaSnapshot({
      reference,
      jobberConnected: connection.connected,
      jobberStatus: connection.status,
      roster,
    });
  }
  if (assessmentResult.error || trialResult.error || reviewIdResult.error) {
    throw new Error("Technician readiness evidence could not be loaded safely.");
  }

  const assessmentRows = (assessmentResult.data ?? []) as CompetencyAssessmentRow[];
  const assessments = assessmentRows.map(toAssessment);
  const trialRows = (trialResult.data ?? []) as IndependentDayTrialRow[];
  const reviewAppointmentIds = (reviewIdResult.data ?? []).flatMap((row) =>
    typeof row.appointment_id === "string" ? [row.appointment_id] : [],
  );
  const loadedReviews = await loadFieldIndependenceReviews(reviewAppointmentIds);
  if (!loadedReviews.available) {
    return missingSchemaSnapshot({
      reference,
      jobberConnected: connection.connected,
      jobberStatus: connection.status,
      roster,
    });
  }
  const reviews = [...loadedReviews.byAppointmentId.values()];
  const exceptions = await loadOpenExceptions(
    reviews.map((review) => review.appointmentId),
  );
  const warnings: string[] = [];
  const lastJobberSyncAt =
    typeof latestSyncResult.data?.source_observed_at === "string"
      ? latestSyncResult.data.source_observed_at
      : null;
  const jobberDataFresh =
    connection.connected &&
    !latestSyncResult.error &&
    lastJobberSyncAt !== null &&
    !isJobberTodayDataStale(lastJobberSyncAt, reference);
  if (exceptions.warning) warnings.push(exceptions.warning);
  if (!connection.connected) {
    warnings.push(
      "Jobber is not connected. Route trials remain source unavailable until the connection is healthy.",
    );
  } else if (!jobberDataFresh) {
    warnings.push(
      "The latest Jobber projection is older than six hours or unavailable. Trial outcomes remain source unavailable until a fresh full sync completes.",
    );
  }

  const identityByJobberUserId = new Map<
    string,
    { displayName: string; rosterIndex: number | null }
  >();
  roster.crew.forEach((member, index) => {
    identityByJobberUserId.set(member.jobberUserId, {
      displayName: member.displayName,
      rosterIndex: index,
    });
  });
  for (const assessment of assessments) {
    if (!identityByJobberUserId.has(assessment.jobberUserId)) {
      identityByJobberUserId.set(assessment.jobberUserId, {
        displayName: assessment.displayName,
        rosterIndex: null,
      });
    }
  }
  for (const trial of trialRows) {
    if (!identityByJobberUserId.has(trial.jobber_user_id)) {
      identityByJobberUserId.set(trial.jobber_user_id, {
        displayName: trial.display_name,
        rosterIndex: null,
      });
    }
  }

  const reviewsByTechnician = reviewByTechnician(reviews);
  const technicians = [...identityByJobberUserId.entries()]
    .map(([jobberUserId, identity]) => {
      const crewMember =
        identity.rosterIndex == null
          ? null
          : roster.crew[identity.rosterIndex] ?? null;
      const technicianReviews = reviewsByTechnician.get(jobberUserId) ?? [];
      const qualifying = technicianReviews.filter((review) =>
        fieldReviewCountsAsBoughtBackTime(
          review,
          exceptions.warning !== null ||
            exceptions.appointmentIds.has(review.appointmentId),
        ),
      );
      return deriveTechnicianReadiness({
        jobberUserId,
        displayName: identity.displayName,
        mirroredRosterActive: crewMember !== null,
        fieldPassState: resolveTechnicianFieldPassState(
          crewMember?.currentGrant ?? null,
          reference,
        ),
        assessments: assessments.filter(
          (assessment) => assessment.jobberUserId === jobberUserId,
        ),
        independentJobs: qualifying.length,
        independentMinutes: qualifying.reduce(
          (sum, review) => sum + (review.productionMinutes ?? 0),
          0,
        ),
        ownerInterventionJobs: technicianReviews.filter(
          (review) => review.ownerInvolvement !== "none",
        ).length,
        qualityExceptionJobs: technicianReviews.filter(
          (review) =>
            review.qualityOutcome !== "verified" ||
            exceptions.warning !== null ||
            exceptions.appointmentIds.has(review.appointmentId),
        ).length,
        lastIndependentServiceDate:
          qualifying
            .map((review) => review.serviceDate)
            .sort((left, right) => right.localeCompare(left))[0] ?? null,
      });
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const projectionsByDate = new Map<string, TrialVisitProjectionRow[]>();
  const assignmentEvidenceByDate = new Map<string, boolean>();
  const trialDates = [...new Set(trialRows.map((trial) => trial.trial_date))];
  if (jobberDataFresh && trialDates.length > 0) {
    const sortedDates = [...trialDates].sort();
    const startUtc = zonedDateTimeToUtc(sortedDates[0]!, 0, 0, 0);
    const endUtc = zonedDateTimeToUtc(
      shiftCalendarDate(sortedDates.at(-1)!, 1),
      0,
      0,
      0,
    );
    const projectionResult = await supabase
      .from("jobber_visit_projections")
      .select("external_visit_id, scheduled_start, is_complete, raw_payload")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .neq("visit_status", "REMOVED")
      .gte("scheduled_start", startUtc.toISOString())
      .lt("scheduled_start", endUtc.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(5_000);
    if (projectionResult.error) {
      warnings.push(
        "Jobber route projections could not be verified. Trial outcomes remain source unavailable.",
      );
      for (const date of trialDates) assignmentEvidenceByDate.set(date, false);
    } else {
      for (const date of trialDates) assignmentEvidenceByDate.set(date, true);
      for (const projection of (projectionResult.data ?? []) as TrialVisitProjectionRow[]) {
        const date = formatBusinessCalendarDate(
          new Date(projection.scheduled_start),
        );
        const list = projectionsByDate.get(date) ?? [];
        list.push(projection);
        projectionsByDate.set(date, list);
        if (
          readJobberTodayVisitAssignment(projection.raw_payload)
            .assignmentReadState !== "available"
        ) {
          assignmentEvidenceByDate.set(date, false);
        }
      }
    }
  }

  const reviewByExternalIdentity = new Map<string, FieldIndependenceReview>();
  for (const review of reviews) {
    reviewByExternalIdentity.set(
      `${review.technicianJobberUserId}\u0000${review.externalVisitId}`,
      review,
    );
  }
  const trials: IndependentDayTrial[] = trialRows.map((trial) => {
    const dayProjections = projectionsByDate.get(trial.trial_date) ?? [];
    const assigned = dayProjections.filter((projection) => {
      const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
      return assignment.assignedUsers.some(
        (user) => user.id === trial.jobber_user_id,
      );
    });
    const completedStops = assigned.filter((projection) => projection.is_complete).length;
    const assignedReviews = assigned.flatMap((projection) => {
      const review = reviewByExternalIdentity.get(
        `${trial.jobber_user_id}\u0000${projection.external_visit_id}`,
      );
      return review ? [review] : [];
    });
    const qualifyingIndependentStops = assignedReviews.filter((review) =>
      fieldReviewCountsAsBoughtBackTime(
        review,
        exceptions.warning !== null ||
          exceptions.appointmentIds.has(review.appointmentId),
      ),
    ).length;
    const assignmentEvidenceAvailable =
      assignmentEvidenceByDate.get(trial.trial_date) ?? jobberDataFresh;
    return {
      id: trial.id,
      jobberUserId: trial.jobber_user_id,
      displayName: trial.display_name,
      trialDate: trial.trial_date,
      status: trial.status,
      planNote: trial.plan_note,
      plannedBy: trial.planned_by,
      plannedAt: trial.planned_at,
      cancelledAt: trial.cancelled_at,
      cancelledBy: trial.cancelled_by,
      cancellationReason: trial.cancellation_reason,
      outcome: deriveIndependentDayOutcome({
        status: trial.status,
        trialDate: trial.trial_date,
        today,
        jobberConnected: connection.connected,
        assignmentEvidenceAvailable,
        scheduledStops: assigned.length,
        completedStops,
        reviewedStops: assignedReviews.length,
        qualifyingIndependentStops,
      }),
      scheduledStops: assigned.length,
      completedStops,
      reviewedStops: assignedReviews.length,
      qualifyingIndependentStops,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    today,
    schemaAvailable: true,
    jobberConnected: connection.connected,
    jobberStatus: connection.status,
    jobberDataFresh,
    lastJobberSyncAt,
    technicians,
    trials,
    warnings,
  };
}

async function resolveMirroredTechnician(input: {
  jobberUserId: string;
  displayName: string;
}) {
  const roster = await listTechnicianAccessRoster();
  const technician = roster.crew.find(
    (member) =>
      member.jobberUserId === input.jobberUserId &&
      member.displayName === input.displayName,
  );
  if (!technician) {
    throw new Error(
      "Choose the exact technician identity from the current mirrored Jobber roster.",
    );
  }
  return technician;
}

async function verifyAssessmentSourceAppointment(input: {
  appointmentId: string;
  jobberUserId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const appointmentResult = await supabase
    .from("member_appointments")
    .select("provider, external_id, verification_state, match_state")
    .eq("id", input.appointmentId)
    .maybeSingle();
  if (appointmentResult.error || !appointmentResult.data) {
    throw new Error("The assessment source appointment was not found.");
  }
  const appointment = appointmentResult.data as AssessmentAppointmentRow;
  if (
    appointment.provider !== "jobber" ||
    !appointment.external_id ||
    appointment.verification_state !== "verified" ||
    appointment.match_state !== "matched"
  ) {
    throw new Error("Assessment evidence must use a verified Jobber appointment.");
  }
  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select("is_complete, raw_payload")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_visit_id", appointment.external_id)
    .maybeSingle();
  if (projectionResult.error || !projectionResult.data) {
    throw new Error("Refresh Jobber before attaching that appointment as evidence.");
  }
  const projection = projectionResult.data as AssessmentProjectionRow;
  const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
  if (
    !projection.is_complete ||
    assignment.assignmentReadState !== "available" ||
    !assignment.assignedUsers.some((user) => user.id === input.jobberUserId)
  ) {
    throw new Error(
      "Assessment evidence must be a completed Jobber visit assigned to this technician.",
    );
  }
}

export async function recordTechnicianCompetencyAssessment(
  input: RecordTechnicianCompetencyInput,
): Promise<TechnicianCompetencyAssessment> {
  const validationError = validateTechnicianCompetencyInput(input);
  if (validationError) throw new Error(validationError);
  const technician = await resolveMirroredTechnician(input);
  if (input.sourceAppointmentId) {
    await verifyAssessmentSourceAppointment({
      appointmentId: input.sourceAppointmentId,
      jobberUserId: technician.jobberUserId,
    });
  }
  const result = await createServiceRoleSupabaseClient()
    .from("technician_competency_assessments")
    .insert({
      jobber_user_id: technician.jobberUserId,
      display_name: technician.displayName,
      competency: input.competency,
      rating: input.rating,
      evidence_note: input.evidenceNote.trim(),
      source_appointment_id: input.sourceAppointmentId ?? null,
      assessed_by: "HomeAtlas HQ",
    })
    .select(ASSESSMENT_SELECT)
    .single();
  if (result.error || !result.data) {
    if (isMissingTechnicianReadinessSchema(result.error)) {
      throw new Error("Apply HomeAtlas migration 062 before saving readiness evidence.");
    }
    throw new Error(result.error?.message ?? "Could not save readiness evidence.");
  }
  return toAssessment(result.data as CompetencyAssessmentRow);
}

export async function planTechnicianIndependentDay(
  input: PlanIndependentDayInput,
  reference: Date = new Date(),
): Promise<IndependentDayTrialRow> {
  const validationError = validateIndependentDayPlanInput(input);
  if (validationError) throw new Error(validationError);
  if (!isValidCalendarDate(input.trialDate)) {
    throw new Error("Choose a real calendar date for the trial.");
  }
  const today = formatBusinessCalendarDate(reference);
  const lastAllowedDate = shiftCalendarDate(today, 60);
  if (input.trialDate < today || input.trialDate > lastAllowedDate) {
    throw new Error("Plan the independent day between today and 60 days from now.");
  }
  const technician = await resolveMirroredTechnician(input);
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("technician_independent_day_trials")
    .select("id, trial_date")
    .eq("jobber_user_id", technician.jobberUserId)
    .eq("status", "planned")
    .gte("trial_date", today)
    .order("trial_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error && isMissingTechnicianReadinessSchema(existing.error)) {
    throw new Error("Apply HomeAtlas migration 062 before planning a trial.");
  }
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    throw new Error(
      `This technician already has an active trial on ${existing.data.trial_date}. Cancel it before planning another.`,
    );
  }
  const result = await supabase
    .from("technician_independent_day_trials")
    .insert({
      jobber_user_id: technician.jobberUserId,
      display_name: technician.displayName,
      trial_date: input.trialDate,
      plan_note: input.planNote?.trim() || null,
      planned_by: "HomeAtlas HQ",
    })
    .select(TRIAL_SELECT)
    .single();
  if (result.error || !result.data) {
    if (isMissingTechnicianReadinessSchema(result.error)) {
      throw new Error("Apply HomeAtlas migration 062 before planning a trial.");
    }
    throw new Error(result.error?.message ?? "Could not plan the independent day.");
  }
  return result.data as IndependentDayTrialRow;
}

export async function cancelTechnicianIndependentDay(input: {
  trialId: string;
  reason: string;
}): Promise<IndependentDayTrialRow> {
  const validationError = validateIndependentDayCancellation(input);
  if (validationError) throw new Error(validationError);
  const result = await createServiceRoleSupabaseClient()
    .from("technician_independent_day_trials")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: "HomeAtlas HQ",
      cancellation_reason: input.reason.trim(),
    })
    .eq("id", input.trialId)
    .eq("status", "planned")
    .select(TRIAL_SELECT)
    .maybeSingle();
  if (result.error) {
    if (isMissingTechnicianReadinessSchema(result.error)) {
      throw new Error("Apply HomeAtlas migration 062 before cancelling a trial.");
    }
    throw new Error(result.error.message);
  }
  if (!result.data) throw new Error("That trial is no longer active.");
  return result.data as IndependentDayTrialRow;
}
