export interface TechnicianCapacityPlan {
  id: string;
  clientRequestId: string;
  jobberUserId: string;
  displayName: string;
  effectiveWeekStart: string;
  weeklyCapacityMinutes: number;
  planningHourlyCostCents: number | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

export type TechnicianCapacityWeekState =
  | "ready"
  | "no_plan"
  | "source_unavailable";

export interface TechnicianCapacityWeekForecast {
  weekStart: string;
  weekEndExclusive: string;
  plan: TechnicianCapacityPlan | null;
  state: TechnicianCapacityWeekState;
  scheduledStops: number | null;
  scheduledMinutes: number | null;
  capacityMinutes: number | null;
  remainingMinutes: number | null;
  utilizationPercent: number | null;
  planningLaborCostCents: number | null;
  overCapacity: boolean;
  detail: string;
}

export interface TechnicianCapacityView {
  jobberUserId: string;
  displayName: string;
  mirroredRosterActive: boolean;
  weeks: TechnicianCapacityWeekForecast[];
}

export interface TechnicianCapacityWeekDemand {
  weekStart: string;
  weekEndExclusive: string;
  sourceAvailable: boolean;
  scheduledVisits: number | null;
  scheduledCrewMinutes: number | null;
  declaredCapacityMinutes: number | null;
  remainingCrewMinutes: number | null;
  unassignedStops: number | null;
  unassignedMinutes: number | null;
  assignmentUnknownStops: number;
}

export interface TechnicianCapacitySnapshot {
  generatedAt: string;
  today: string;
  schemaAvailable: boolean;
  jobberConnected: boolean;
  jobberStatus: string;
  jobberDataFresh: boolean;
  lastJobberSyncAt: string | null;
  technicians: TechnicianCapacityView[];
  weeks: TechnicianCapacityWeekDemand[];
  warnings: string[];
}

export interface RecordTechnicianCapacityPlanInput {
  clientRequestId: string;
  jobberUserId: string;
  displayName: string;
  effectiveWeekStart: string;
  weeklyCapacityMinutes: number;
  planningHourlyCostCents: number | null;
  notes?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateTechnicianCapacityPlanInput(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid technician capacity plan.";
  }
  const input = value as Partial<RecordTechnicianCapacityPlanInput>;
  if (!UUID_PATTERN.test(input.clientRequestId ?? "")) {
    return "Create a valid request ID for this capacity plan.";
  }
  if (
    typeof input.jobberUserId !== "string" ||
    input.jobberUserId.trim().length < 1 ||
    input.jobberUserId.trim().length > 255 ||
    typeof input.displayName !== "string" ||
    input.displayName.trim().length < 2 ||
    input.displayName.trim().length > 80
  ) {
    return "Choose a technician from the mirrored Jobber roster.";
  }
  if (!DATE_PATTERN.test(input.effectiveWeekStart ?? "")) {
    return "Choose a valid effective week.";
  }
  if (
    !Number.isInteger(input.weeklyCapacityMinutes) ||
    (input.weeklyCapacityMinutes ?? -1) < 0 ||
    (input.weeklyCapacityMinutes ?? 4_801) > 4_800
  ) {
    return "Weekly capacity must be a whole number from 0 to 4,800 minutes.";
  }
  if (
    input.planningHourlyCostCents !== null &&
    (!Number.isInteger(input.planningHourlyCostCents) ||
      (input.planningHourlyCostCents ?? -1) < 0 ||
      (input.planningHourlyCostCents ?? 100_001) > 100_000)
  ) {
    return "Planning labor cost must be between $0 and $1,000 per hour.";
  }
  if ((input.notes ?? "").trim().length > 1_000) {
    return "Capacity notes must be 1,000 characters or fewer.";
  }
  return null;
}

export function deriveTechnicianCapacityWeek(input: {
  weekStart: string;
  weekEndExclusive: string;
  plan: TechnicianCapacityPlan | null;
  sourceAvailable: boolean;
  scheduledStops: number;
  scheduledMinutes: number;
}): TechnicianCapacityWeekForecast {
  if (!input.sourceAvailable) {
    return {
      weekStart: input.weekStart,
      weekEndExclusive: input.weekEndExclusive,
      plan: input.plan,
      state: "source_unavailable",
      scheduledStops: null,
      scheduledMinutes: null,
      capacityMinutes: input.plan?.weeklyCapacityMinutes ?? null,
      remainingMinutes: null,
      utilizationPercent: null,
      planningLaborCostCents: null,
      overCapacity: false,
      detail:
        "Jobber assignment or duration evidence is incomplete. Booked capacity is unknown, not zero.",
    };
  }
  if (!input.plan) {
    return {
      weekStart: input.weekStart,
      weekEndExclusive: input.weekEndExclusive,
      plan: null,
      state: "no_plan",
      scheduledStops: input.scheduledStops,
      scheduledMinutes: input.scheduledMinutes,
      capacityMinutes: null,
      remainingMinutes: null,
      utilizationPercent: null,
      planningLaborCostCents: null,
      overCapacity: false,
      detail:
        "The booked route is visible, but no owner-declared weekly capacity exists for comparison.",
    };
  }

  const capacityMinutes = input.plan.weeklyCapacityMinutes;
  const remainingMinutes = capacityMinutes - input.scheduledMinutes;
  const overCapacity = input.scheduledMinutes > capacityMinutes;
  const utilizationPercent =
    capacityMinutes > 0
      ? (input.scheduledMinutes / capacityMinutes) * 100
      : input.scheduledMinutes === 0
        ? 0
        : null;
  const planningLaborCostCents =
    input.plan.planningHourlyCostCents === null
      ? null
      : Math.round(
          (input.scheduledMinutes / 60) *
            input.plan.planningHourlyCostCents,
        );

  return {
    weekStart: input.weekStart,
    weekEndExclusive: input.weekEndExclusive,
    plan: input.plan,
    state: "ready",
    scheduledStops: input.scheduledStops,
    scheduledMinutes: input.scheduledMinutes,
    capacityMinutes,
    remainingMinutes,
    utilizationPercent,
    planningLaborCostCents,
    overCapacity,
    detail: overCapacity
      ? `${Math.abs(remainingMinutes)} scheduled minutes exceed the declared weekly capacity.`
      : `${remainingMinutes} declared production minutes remain unbooked in the current Jobber snapshot.`,
  };
}
