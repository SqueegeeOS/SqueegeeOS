import type { FieldIndependenceReview } from "@/lib/field-operations/independence-review";
import { fieldReviewCountsAsBoughtBackTime } from "@/lib/field-operations/independence-review";

export const OWNER_TIME_BUYBACK_LADDER_HOURS = [8, 16, 24, 32] as const;
export const DEDICATED_GROWTH_DAY_MINUTES = 240;
export const NEW_ARR_PER_GROWTH_DAY = {
  floor: 500,
  target: 1_000,
  excellent: 2_000,
} as const;

export const GROWTH_CHANNELS = [
  "door_to_door",
  "google",
  "paid_ads",
  "past_customer_reactivation",
  "memberships",
  "referrals",
  "upsells",
  "local_partnerships",
  "other",
] as const;

export type GrowthChannel = (typeof GROWTH_CHANNELS)[number];
export type GrowthSessionStatus = "open" | "completed" | "cancelled";
export type GrowthDayBand = "below_floor" | "floor" | "target" | "excellent";

export interface GrowthOperator {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string;
}

export interface GrowthWorkSession {
  id: string;
  operatorId: string;
  operatorSlug: string;
  operatorName: string;
  businessDate: string;
  channel: GrowthChannel;
  status: GrowthSessionStatus;
  startedAt: string;
  endedAt: string | null;
  breakMinutes: number;
  notes: string | null;
}

export interface OwnerLeverageReviewEvidence {
  review: FieldIndependenceReview;
  hasOpenException: boolean;
}

export interface OwnerAttributedClose {
  arrCents: number;
  attributedAt: string;
  businessDate: string;
  operatorId: string;
}

export interface OwnerPresentationCohortRow {
  id: string;
  operatorId: string;
  signedAt: string | null;
}

export interface IndependentTechnicianBreakdown {
  technicianJobberUserId: string;
  technicianDisplayName: string;
  jobs: number;
  minutes: number;
}

export interface OwnerLeverageMetrics {
  ownerFieldHoursBoughtBack: number;
  independentProductionHours: number;
  independentJobs: number;
  reviewedJobs: number;
  ownerInterventionJobs: number;
  ownerInterventionHours: number;
  qualityExceptionJobs: number;
  growthHours: number;
  dedicatedGrowthDays: number;
  newAttributedArr: number;
  newArrPerGrowthHour: number | null;
  newArrPerDedicatedGrowthDay: number | null;
  growthDayBand: GrowthDayBand | null;
  leadsCreated: number;
  presentationsStarted: number;
  membershipsClosed: number;
  presentationCloseRate: number | null;
  nextBuybackTargetHours: number;
  buybackProgressPercent: number;
  today: {
    independentJobs: number;
    independentProductionHours: number;
    ownerInterventionJobs: number;
    growthHours: number;
    newAttributedArr: number;
  };
  technicianBreakdown: IndependentTechnicianBreakdown[];
}

export interface OwnerLeverageSnapshot {
  generatedAt: string;
  source: "supabase" | "unavailable";
  schemaAvailable: boolean;
  period: {
    businessWeekStart: string;
    businessWeekEndExclusive: string;
    today: string;
  };
  operators: GrowthOperator[];
  openSessions: GrowthWorkSession[];
  recentSessions: GrowthWorkSession[];
  metrics: OwnerLeverageMetrics;
  unreviewedCompletedVisits: number;
  sources: {
    fieldReviews: "ready" | "unavailable";
    growthSessions: "ready" | "unavailable";
    signedArrAttribution: "ready" | "unavailable";
    jobberCompletion: "ready" | "unavailable";
  };
  warnings: string[];
}

export interface OwnerLeverageMetricInput {
  today: string;
  reviews: OwnerLeverageReviewEvidence[];
  sessions: GrowthWorkSession[];
  attributedCloses: OwnerAttributedClose[];
  presentationCohort: OwnerPresentationCohortRow[];
  leadsCreated: number;
}

export function growthSessionMinutes(
  session: Pick<
    GrowthWorkSession,
    "status" | "startedAt" | "endedAt" | "breakMinutes"
  >,
): number {
  if (session.status !== "completed" || !session.endedAt) return 0;
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const elapsed = Math.round((end - start) / 60_000);
  return Math.max(0, Math.min(960, elapsed) - session.breakMinutes);
}

export function classifyGrowthDay(value: number): GrowthDayBand {
  if (value >= NEW_ARR_PER_GROWTH_DAY.excellent) return "excellent";
  if (value >= NEW_ARR_PER_GROWTH_DAY.target) return "target";
  if (value >= NEW_ARR_PER_GROWTH_DAY.floor) return "floor";
  return "below_floor";
}

function nextBuybackTarget(hours: number): number {
  return (
    OWNER_TIME_BUYBACK_LADDER_HOURS.find((target) => hours < target) ??
    OWNER_TIME_BUYBACK_LADDER_HOURS.at(-1)!
  );
}

export function calculateOwnerLeverageMetrics(
  input: OwnerLeverageMetricInput,
): OwnerLeverageMetrics {
  const qualifyingReviews = input.reviews.filter(({ review, hasOpenException }) =>
    fieldReviewCountsAsBoughtBackTime(review, hasOpenException),
  );
  const independentMinutes = qualifyingReviews.reduce(
    (sum, { review }) => sum + (review.productionMinutes ?? 0),
    0,
  );
  const ownerInterventionReviews = input.reviews.filter(
    ({ review }) => review.ownerInvolvement !== "none",
  );
  const qualityExceptionJobs = input.reviews.filter(
    ({ review, hasOpenException }) =>
      review.qualityOutcome !== "verified" || hasOpenException,
  ).length;
  const sessionMinutes = input.sessions.reduce(
    (sum, session) => sum + growthSessionMinutes(session),
    0,
  );
  const minutesByDay = new Map<string, number>();
  for (const session of input.sessions) {
    minutesByDay.set(
      session.businessDate,
      (minutesByDay.get(session.businessDate) ?? 0) +
        growthSessionMinutes(session),
    );
  }
  const dedicatedGrowthDates = new Set(
    [...minutesByDay.entries()]
      .filter(([, minutes]) => minutes >= DEDICATED_GROWTH_DAY_MINUTES)
      .map(([businessDate]) => businessDate),
  );
  const dedicatedGrowthDays = dedicatedGrowthDates.size;
  const newAttributedArr =
    input.attributedCloses.reduce((sum, close) => sum + close.arrCents, 0) /
    100;
  const growthHours = sessionMinutes / 60;
  const newArrPerGrowthHour =
    growthHours > 0 ? newAttributedArr / growthHours : null;
  const dedicatedDayAttributedArr =
    input.attributedCloses
      .filter((close) => dedicatedGrowthDates.has(close.businessDate))
      .reduce((sum, close) => sum + close.arrCents, 0) / 100;
  const newArrPerDedicatedGrowthDay =
    dedicatedGrowthDays > 0
      ? dedicatedDayAttributedArr / dedicatedGrowthDays
      : null;
  const presentationsStarted = input.presentationCohort.length;
  const signedPresentations = input.presentationCohort.filter(
    (presentation) => Boolean(presentation.signedAt),
  ).length;
  const hoursBoughtBack = independentMinutes / 60;
  const target = nextBuybackTarget(hoursBoughtBack);

  const breakdownByTechnician = new Map<
    string,
    IndependentTechnicianBreakdown
  >();
  for (const { review } of qualifyingReviews) {
    const existing = breakdownByTechnician.get(
      review.technicianJobberUserId,
    );
    breakdownByTechnician.set(review.technicianJobberUserId, {
      technicianJobberUserId: review.technicianJobberUserId,
      technicianDisplayName: review.technicianDisplayName,
      jobs: (existing?.jobs ?? 0) + 1,
      minutes: (existing?.minutes ?? 0) + (review.productionMinutes ?? 0),
    });
  }

  const todayReviews = qualifyingReviews.filter(
    ({ review }) => review.serviceDate === input.today,
  );
  const todaySessions = input.sessions.filter(
    (session) => session.businessDate === input.today,
  );
  const todayCloses = input.attributedCloses.filter(
    (close) => close.businessDate === input.today,
  );

  return {
    ownerFieldHoursBoughtBack: hoursBoughtBack,
    independentProductionHours: hoursBoughtBack,
    independentJobs: qualifyingReviews.length,
    reviewedJobs: input.reviews.length,
    ownerInterventionJobs: ownerInterventionReviews.length,
    ownerInterventionHours:
      ownerInterventionReviews.reduce(
        (sum, { review }) => sum + review.ownerMinutes,
        0,
      ) / 60,
    qualityExceptionJobs,
    growthHours,
    dedicatedGrowthDays,
    newAttributedArr,
    newArrPerGrowthHour,
    newArrPerDedicatedGrowthDay,
    growthDayBand:
      newArrPerDedicatedGrowthDay == null
        ? null
        : classifyGrowthDay(newArrPerDedicatedGrowthDay),
    leadsCreated: input.leadsCreated,
    presentationsStarted,
    membershipsClosed: input.attributedCloses.length,
    presentationCloseRate:
      presentationsStarted > 0
        ? (signedPresentations / presentationsStarted) * 100
        : null,
    nextBuybackTargetHours: target,
    buybackProgressPercent: Math.min(100, (hoursBoughtBack / target) * 100),
    today: {
      independentJobs: todayReviews.length,
      independentProductionHours:
        todayReviews.reduce(
          (sum, { review }) => sum + (review.productionMinutes ?? 0),
          0,
        ) / 60,
      ownerInterventionJobs: input.reviews.filter(
        ({ review }) =>
          review.serviceDate === input.today &&
          review.ownerInvolvement !== "none",
      ).length,
      growthHours:
        todaySessions.reduce(
          (sum, session) => sum + growthSessionMinutes(session),
          0,
        ) / 60,
      newAttributedArr:
        todayCloses.reduce((sum, close) => sum + close.arrCents, 0) / 100,
    },
    technicianBreakdown: [...breakdownByTechnician.values()].sort(
      (left, right) => right.minutes - left.minutes,
    ),
  };
}

export function emptyOwnerLeverageMetrics(): OwnerLeverageMetrics {
  return calculateOwnerLeverageMetrics({
    today: "",
    reviews: [],
    sessions: [],
    attributedCloses: [],
    presentationCohort: [],
    leadsCreated: 0,
  });
}
