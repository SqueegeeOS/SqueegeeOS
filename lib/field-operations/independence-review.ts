export const FIELD_JOB_CLASSES = ["normal", "exceptional"] as const;
export const OWNER_INVOLVEMENT_LEVELS = [
  "none",
  "remote_guidance",
  "onsite_assist",
  "owner_led",
] as const;
export const FIELD_QUALITY_OUTCOMES = [
  "verified",
  "follow_up",
  "rework",
  "safety_stop",
] as const;

export type FieldJobClass = (typeof FIELD_JOB_CLASSES)[number];
export type OwnerInvolvement = (typeof OWNER_INVOLVEMENT_LEVELS)[number];
export type FieldQualityOutcome = (typeof FIELD_QUALITY_OUTCOMES)[number];
export type FieldDurationSource =
  | "field_events"
  | "jobber_schedule"
  | "unavailable";

export interface FieldIndependenceReview {
  id: string;
  appointmentId: string;
  propertyId: string;
  externalVisitId: string;
  serviceDate: string;
  technicianJobberUserId: string;
  technicianDisplayName: string;
  jobClass: FieldJobClass;
  ownerInvolvement: OwnerInvolvement;
  ownerMinutes: number;
  qualityOutcome: FieldQualityOutcome;
  productionMinutes: number | null;
  durationSource: FieldDurationSource;
  sourceVerifiedAt: string | null;
  reviewedBy: string;
  reviewNote: string | null;
  reviewedAt: string;
}

export interface RecordFieldIndependenceReviewInput {
  appointmentId: string;
  propertyId: string;
  technicianJobberUserId: string;
  jobClass: FieldJobClass;
  ownerInvolvement: OwnerInvolvement;
  ownerMinutes: number;
  qualityOutcome: FieldQualityOutcome;
  reviewNote?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFieldIndependenceReviewInput(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid field independence review.";
  }
  const input = value as Partial<RecordFieldIndependenceReviewInput>;
  if (!UUID_PATTERN.test(input.appointmentId ?? "")) {
    return "Choose a valid HomeAtlas appointment.";
  }
  if (!UUID_PATTERN.test(input.propertyId ?? "")) {
    return "Choose a valid HomeAtlas property.";
  }
  if (
    typeof input.technicianJobberUserId !== "string" ||
    !input.technicianJobberUserId.trim() ||
    input.technicianJobberUserId.trim().length > 255
  ) {
    return "Choose the technician who owned this Jobber visit.";
  }
  if (!FIELD_JOB_CLASSES.includes(input.jobClass as FieldJobClass)) {
    return "Choose whether this was a normal or exceptional job.";
  }
  if (
    !OWNER_INVOLVEMENT_LEVELS.includes(
      input.ownerInvolvement as OwnerInvolvement,
    )
  ) {
    return "Choose how much owner involvement the visit required.";
  }
  if (
    !Number.isInteger(input.ownerMinutes) ||
    (input.ownerMinutes ?? -1) < 0 ||
    (input.ownerMinutes ?? 961) > 960
  ) {
    return "Owner time must be a whole number from 0 to 960 minutes.";
  }
  if (input.ownerInvolvement === "none" && input.ownerMinutes !== 0) {
    return "A no-owner visit must record zero owner minutes.";
  }
  if (input.ownerInvolvement !== "none" && input.ownerMinutes === 0) {
    return "Record at least one owner minute when help was required.";
  }
  if (
    !FIELD_QUALITY_OUTCOMES.includes(
      input.qualityOutcome as FieldQualityOutcome,
    )
  ) {
    return "Choose the verified quality outcome.";
  }
  if ((input.reviewNote ?? "").trim().length > 2_000) {
    return "Review notes must be 2,000 characters or fewer.";
  }
  return null;
}

export function fieldReviewCountsAsBoughtBackTime(
  review: Pick<
    FieldIndependenceReview,
    "jobClass" | "ownerInvolvement" | "qualityOutcome" | "productionMinutes"
  >,
  hasOpenException = false,
): boolean {
  return (
    review.jobClass === "normal" &&
    review.ownerInvolvement === "none" &&
    review.qualityOutcome === "verified" &&
    review.productionMinutes !== null &&
    review.productionMinutes > 0 &&
    !hasOpenException
  );
}

export function resolveVerifiedProductionDuration(input: {
  serviceStartedAt: string | null;
  serviceCompletedAt: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
}): { minutes: number | null; source: FieldDurationSource } {
  const eventMinutes = durationMinutes(
    input.serviceStartedAt,
    input.serviceCompletedAt,
  );
  if (eventMinutes !== null) {
    return { minutes: eventMinutes, source: "field_events" };
  }
  const scheduledMinutes = durationMinutes(
    input.scheduledStart,
    input.scheduledEnd,
  );
  if (scheduledMinutes !== null) {
    return { minutes: scheduledMinutes, source: "jobber_schedule" };
  }
  return { minutes: null, source: "unavailable" };
}

function durationMinutes(
  startValue: string | null,
  endValue: string | null,
): number | null {
  if (!startValue || !endValue) return null;
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const minutes = Math.round((end - start) / 60_000);
  return minutes >= 1 && minutes <= 960 ? minutes : null;
}
