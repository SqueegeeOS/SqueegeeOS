export const TECHNICIAN_COMPETENCIES = [
  {
    id: "route_ownership",
    label: "Route ownership",
    detail: "Reads the day, sequences stops, and protects arrival windows without owner prompting.",
  },
  {
    id: "scope_and_property_context",
    label: "Scope + property context",
    detail: "Confirms purchased scope, access notes, exclusions, and property memory before work.",
  },
  {
    id: "equipment_and_setup",
    label: "Equipment + setup",
    detail: "Loads, inspects, stages, and restores the required equipment independently.",
  },
  {
    id: "safety_and_stop_work",
    label: "Safety + stop-work judgment",
    detail: "Identifies unsafe conditions and pauses work instead of improvising through risk.",
  },
  {
    id: "service_quality",
    label: "Service quality",
    detail: "Delivers the promised finish and performs a reliable final quality check.",
  },
  {
    id: "customer_handoff",
    label: "Customer handoff",
    detail: "Communicates clearly, protects privacy, and sets accurate expectations without overselling.",
  },
  {
    id: "closeout_and_proof",
    label: "Closeout + proof",
    detail: "Records completed scope, notes, photos, and follow-ups before leaving the stop.",
  },
  {
    id: "exception_escalation",
    label: "Exception escalation",
    detail: "Solves normal variance and escalates the exact decision when owner judgment is required.",
  },
] as const;

export const TECHNICIAN_COMPETENCY_RATINGS = [
  "learning",
  "supervised",
  "independent",
] as const;

export type TechnicianCompetencyId =
  (typeof TECHNICIAN_COMPETENCIES)[number]["id"];
export type TechnicianCompetencyRating =
  (typeof TECHNICIAN_COMPETENCY_RATINGS)[number];

export interface TechnicianCompetencyAssessment {
  id: string;
  jobberUserId: string;
  displayName: string;
  competency: TechnicianCompetencyId;
  rating: TechnicianCompetencyRating;
  evidenceNote: string;
  sourceAppointmentId: string | null;
  assessedBy: string;
  assessedAt: string;
}

export interface TechnicianCompetencyView {
  id: TechnicianCompetencyId;
  label: string;
  detail: string;
  latestAssessment: TechnicianCompetencyAssessment | null;
}

export type TechnicianReadinessGateId =
  | "field_pass"
  | "competency_evidence"
  | "independent_visit";

export interface TechnicianReadinessGate {
  id: TechnicianReadinessGateId;
  label: string;
  passed: boolean;
  detail: string;
}

export interface TechnicianReadinessView {
  jobberUserId: string;
  displayName: string;
  mirroredRosterActive: boolean;
  fieldPassState:
    | "active"
    | "expiring"
    | "pending"
    | "expired"
    | "revoked"
    | "missing";
  competencies: TechnicianCompetencyView[];
  independentCompetencyCount: number;
  independentJobs: number;
  independentHours: number;
  ownerInterventionJobs: number;
  qualityExceptionJobs: number;
  lastIndependentServiceDate: string | null;
  evidenceGates: TechnicianReadinessGate[];
  evidenceCompleteForOwnerDecision: boolean;
}

export type IndependentDayTrialStatus = "planned" | "cancelled";
export type IndependentDayOutcome =
  | "planned"
  | "in_progress"
  | "needs_schedule"
  | "needs_review"
  | "verified"
  | "did_not_verify"
  | "source_unavailable"
  | "cancelled";

export interface IndependentDayTrial {
  id: string;
  jobberUserId: string;
  displayName: string;
  trialDate: string;
  status: IndependentDayTrialStatus;
  planNote: string | null;
  plannedBy: string;
  plannedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  outcome: IndependentDayOutcome;
  scheduledStops: number;
  completedStops: number;
  reviewedStops: number;
  qualifyingIndependentStops: number;
}

export interface TechnicianReadinessSnapshot {
  generatedAt: string;
  today: string;
  schemaAvailable: boolean;
  jobberConnected: boolean;
  jobberStatus: string;
  jobberDataFresh: boolean;
  lastJobberSyncAt: string | null;
  technicians: TechnicianReadinessView[];
  trials: IndependentDayTrial[];
  warnings: string[];
}

export interface RecordTechnicianCompetencyInput {
  jobberUserId: string;
  displayName: string;
  competency: TechnicianCompetencyId;
  rating: TechnicianCompetencyRating;
  evidenceNote: string;
  sourceAppointmentId?: string;
}

export interface PlanIndependentDayInput {
  jobberUserId: string;
  displayName: string;
  trialDate: string;
  planNote?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validIdentity(
  jobberUserId: unknown,
  displayName: unknown,
): boolean {
  return (
    typeof jobberUserId === "string" &&
    jobberUserId.trim().length >= 1 &&
    jobberUserId.trim().length <= 255 &&
    typeof displayName === "string" &&
    displayName.trim().length >= 2 &&
    displayName.trim().length <= 80
  );
}

export function validateTechnicianCompetencyInput(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid technician competency assessment.";
  }
  const input = value as Partial<RecordTechnicianCompetencyInput>;
  if (!validIdentity(input.jobberUserId, input.displayName)) {
    return "Choose a technician from the mirrored Jobber roster.";
  }
  if (
    !TECHNICIAN_COMPETENCIES.some(
      (competency) => competency.id === input.competency,
    )
  ) {
    return "Choose a valid technician competency.";
  }
  if (
    !TECHNICIAN_COMPETENCY_RATINGS.includes(
      input.rating as TechnicianCompetencyRating,
    )
  ) {
    return "Choose learning, supervised, or independent.";
  }
  const evidence = input.evidenceNote?.trim() ?? "";
  if (evidence.length < 10 || evidence.length > 1_000) {
    return "Evidence must be between 10 and 1,000 characters.";
  }
  if (
    input.sourceAppointmentId &&
    !UUID_PATTERN.test(input.sourceAppointmentId)
  ) {
    return "Choose a valid source appointment.";
  }
  return null;
}

export function validateIndependentDayPlanInput(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid independent-day plan.";
  }
  const input = value as Partial<PlanIndependentDayInput>;
  if (!validIdentity(input.jobberUserId, input.displayName)) {
    return "Choose a technician from the mirrored Jobber roster.";
  }
  if (!DATE_PATTERN.test(input.trialDate ?? "")) {
    return "Choose a valid trial date.";
  }
  if ((input.planNote ?? "").trim().length > 1_000) {
    return "Plan notes must be 1,000 characters or fewer.";
  }
  return null;
}

export function validateIndependentDayCancellation(input: {
  trialId?: unknown;
  reason?: unknown;
}): string | null {
  if (typeof input.trialId !== "string" || !UUID_PATTERN.test(input.trialId)) {
    return "Choose a valid independent-day trial.";
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5 || reason.length > 1_000) {
    return "Cancellation reason must be between 5 and 1,000 characters.";
  }
  return null;
}

export function deriveTechnicianReadiness(input: {
  jobberUserId: string;
  displayName: string;
  mirroredRosterActive?: boolean;
  fieldPassState: TechnicianReadinessView["fieldPassState"];
  assessments: TechnicianCompetencyAssessment[];
  independentJobs: number;
  independentMinutes: number;
  ownerInterventionJobs: number;
  qualityExceptionJobs: number;
  lastIndependentServiceDate: string | null;
}): TechnicianReadinessView {
  const latestByCompetency = new Map<
    TechnicianCompetencyId,
    TechnicianCompetencyAssessment
  >();
  for (const assessment of [...input.assessments].sort((left, right) =>
    right.assessedAt.localeCompare(left.assessedAt),
  )) {
    if (!latestByCompetency.has(assessment.competency)) {
      latestByCompetency.set(assessment.competency, assessment);
    }
  }
  const competencies = TECHNICIAN_COMPETENCIES.map((definition) => ({
    ...definition,
    latestAssessment: latestByCompetency.get(definition.id) ?? null,
  }));
  const independentCompetencyCount = competencies.filter(
    (competency) => competency.latestAssessment?.rating === "independent",
  ).length;
  const fieldPassReady =
    input.fieldPassState === "active" || input.fieldPassState === "expiring";
  const competencyEvidenceReady =
    independentCompetencyCount === TECHNICIAN_COMPETENCIES.length;
  const independentVisitReady = input.independentJobs > 0;
  const evidenceGates: TechnicianReadinessGate[] = [
    {
      id: "field_pass",
      label: "Field Pass ready",
      passed: fieldPassReady,
      detail: fieldPassReady
        ? "A usable assignment-bounded phone session exists."
        : "Activate a Field Pass before an owner-independent route.",
    },
    {
      id: "competency_evidence",
      label: "All competencies observed independently",
      passed: competencyEvidenceReady,
      detail: `${independentCompetencyCount}/${TECHNICIAN_COMPETENCIES.length} latest assessments are independent.`,
    },
    {
      id: "independent_visit",
      label: "Independent visit evidence",
      passed: independentVisitReady,
      detail: independentVisitReady
        ? `${input.independentJobs} qualifying normal ${input.independentJobs === 1 ? "visit" : "visits"} in the evidence window.`
        : "No normal, quality-verified, zero-owner visit is proven yet.",
    },
  ];

  return {
    jobberUserId: input.jobberUserId,
    displayName: input.displayName,
    mirroredRosterActive: input.mirroredRosterActive ?? true,
    fieldPassState: input.fieldPassState,
    competencies,
    independentCompetencyCount,
    independentJobs: input.independentJobs,
    independentHours: input.independentMinutes / 60,
    ownerInterventionJobs: input.ownerInterventionJobs,
    qualityExceptionJobs: input.qualityExceptionJobs,
    lastIndependentServiceDate: input.lastIndependentServiceDate,
    evidenceGates,
    evidenceCompleteForOwnerDecision: evidenceGates.every(
      (gate) => gate.passed,
    ),
  };
}

export function deriveIndependentDayOutcome(input: {
  status: IndependentDayTrialStatus;
  trialDate: string;
  today: string;
  jobberConnected: boolean;
  assignmentEvidenceAvailable?: boolean;
  scheduledStops: number;
  completedStops: number;
  reviewedStops: number;
  qualifyingIndependentStops: number;
}): IndependentDayOutcome {
  if (input.status === "cancelled") return "cancelled";
  if (input.trialDate > input.today) return "planned";
  if (!input.jobberConnected || input.assignmentEvidenceAvailable === false) {
    return "source_unavailable";
  }
  if (input.scheduledStops === 0) return "needs_schedule";
  if (
    input.completedStops === input.scheduledStops &&
    input.qualifyingIndependentStops === input.scheduledStops
  ) {
    return "verified";
  }
  if (
    input.trialDate === input.today &&
    input.completedStops < input.scheduledStops
  ) {
    return "in_progress";
  }
  if (input.reviewedStops < input.scheduledStops) return "needs_review";
  return "did_not_verify";
}
