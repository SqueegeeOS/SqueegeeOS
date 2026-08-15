import "server-only";

import {
  formatBusinessCalendarDate,
  getBusinessCalendarWeekUtcBounds,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  isJobberTodayDataStale,
  readJobberTodayVisitAssignment,
} from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { listTechnicianAccessRoster } from "./field-access";
import {
  deriveTechnicianCapacityWeek,
  validateTechnicianCapacityPlanInput,
  type RecordTechnicianCapacityPlanInput,
  type TechnicianCapacityPlan,
  type TechnicianCapacitySnapshot,
  type TechnicianCapacityView,
  type TechnicianCapacityWeekDemand,
} from "./technician-capacity";

interface TechnicianCapacityPlanRow {
  id: string;
  client_request_id: string;
  jobber_user_id: string;
  display_name: string;
  effective_week_start: string;
  weekly_capacity_minutes: number;
  planning_hourly_cost_cents: number | null;
  notes: string | null;
  recorded_by: string;
  recorded_at: string;
}

interface CapacityProjectionRow {
  scheduled_start: string;
  scheduled_end: string | null;
  raw_payload: unknown;
}

interface WeekRange {
  weekStart: string;
  weekEndExclusive: string;
  startUtc: Date;
  endUtc: Date;
}

interface TechnicianWeekLoad {
  scheduledStops: number;
  scheduledMinutes: number;
  durationEvidenceAvailable: boolean;
}

const PLAN_SELECT =
  "id, client_request_id, jobber_user_id, display_name, effective_week_start, weekly_capacity_minutes, planning_hourly_cost_cents, notes, recorded_by, recorded_at";
const PROJECTION_QUERY_LIMIT = 5_001;

function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .startsWith(value);
}

function isMonday(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

function weekRanges(reference: Date, count = 4): WeekRange[] {
  const current = getBusinessCalendarWeekUtcBounds(reference);
  return Array.from({ length: count }, (_, index) => {
    const weekStart = shiftCalendarDate(current.startCalendarDate, index * 7);
    const weekEndExclusive = shiftCalendarDate(weekStart, 7);
    return {
      weekStart,
      weekEndExclusive,
      startUtc: zonedDateTimeToUtc(weekStart, 0, 0, 0),
      endUtc: zonedDateTimeToUtc(weekEndExclusive, 0, 0, 0),
    };
  });
}

function toPlan(row: TechnicianCapacityPlanRow): TechnicianCapacityPlan {
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    jobberUserId: row.jobber_user_id,
    displayName: row.display_name,
    effectiveWeekStart: row.effective_week_start,
    weeklyCapacityMinutes: Number(row.weekly_capacity_minutes),
    planningHourlyCostCents:
      row.planning_hourly_cost_cents == null
        ? null
        : Number(row.planning_hourly_cost_cents),
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}

export function isMissingTechnicianCapacitySchema(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("technician_capacity_plans") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

function planForWeek(
  plans: TechnicianCapacityPlan[],
  jobberUserId: string,
  weekStart: string,
): TechnicianCapacityPlan | null {
  return (
    plans
      .filter(
        (plan) =>
          plan.jobberUserId === jobberUserId &&
          plan.effectiveWeekStart <= weekStart,
      )
      .sort((left, right) => {
        const effective = right.effectiveWeekStart.localeCompare(
          left.effectiveWeekStart,
        );
        return effective !== 0
          ? effective
          : right.recordedAt.localeCompare(left.recordedAt);
      })[0] ?? null
  );
}

function projectionDurationMinutes(
  projection: CapacityProjectionRow,
): number | null {
  if (!projection.scheduled_end) return null;
  const start = new Date(projection.scheduled_start).getTime();
  const end = new Date(projection.scheduled_end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const minutes = Math.round((end - start) / 60_000);
  return minutes >= 1 && minutes <= 960 ? minutes : null;
}

function key(jobberUserId: string, weekStart: string): string {
  return `${jobberUserId}\u0000${weekStart}`;
}

function missingSchemaSnapshot(input: {
  reference: Date;
  roster: Awaited<ReturnType<typeof listTechnicianAccessRoster>>;
  jobberConnected: boolean;
  jobberStatus: string;
}): TechnicianCapacitySnapshot {
  const ranges = weekRanges(input.reference);
  return {
    generatedAt: new Date().toISOString(),
    today: formatBusinessCalendarDate(input.reference),
    schemaAvailable: false,
    jobberConnected: input.jobberConnected,
    jobberStatus: input.jobberStatus,
    jobberDataFresh: false,
    lastJobberSyncAt: null,
    technicians: input.roster.crew.map((member) => ({
      jobberUserId: member.jobberUserId,
      displayName: member.displayName,
      mirroredRosterActive: true,
      weeks: ranges.map((range) =>
        deriveTechnicianCapacityWeek({
          weekStart: range.weekStart,
          weekEndExclusive: range.weekEndExclusive,
          plan: null,
          sourceAvailable: false,
          scheduledStops: 0,
          scheduledMinutes: 0,
        }),
      ),
    })),
    weeks: ranges.map((range) => ({
      weekStart: range.weekStart,
      weekEndExclusive: range.weekEndExclusive,
      sourceAvailable: false,
      scheduledVisits: null,
      scheduledCrewMinutes: null,
      declaredCapacityMinutes: null,
      remainingCrewMinutes: null,
      unassignedStops: null,
      unassignedMinutes: null,
      assignmentUnknownStops: 0,
    })),
    warnings: [
      "Apply migration 063 before using the technician capacity runway.",
    ],
  };
}

export async function loadTechnicianCapacitySnapshot(
  reference: Date = new Date(),
): Promise<TechnicianCapacitySnapshot> {
  const supabase = createServiceRoleSupabaseClient();
  const ranges = weekRanges(reference);
  const [roster, connection, plansResult, latestSyncResult] = await Promise.all([
    listTechnicianAccessRoster(),
    readJobberConnectionStatus(),
    supabase
      .from("technician_capacity_plans")
      .select(PLAN_SELECT)
      .order("effective_week_start", { ascending: false })
      .order("recorded_at", { ascending: false })
      .limit(5_000),
    supabase
      .from("jobber_visit_projections")
      .select("source_observed_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .order("source_observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (isMissingTechnicianCapacitySchema(plansResult.error)) {
    return missingSchemaSnapshot({
      reference,
      roster,
      jobberConnected: connection.connected,
      jobberStatus: connection.status,
    });
  }
  if (plansResult.error) {
    throw new Error("Technician capacity plans could not be loaded safely.");
  }

  const plans = ((plansResult.data ?? []) as TechnicianCapacityPlanRow[]).map(
    toPlan,
  );
  const lastJobberSyncAt =
    typeof latestSyncResult.data?.source_observed_at === "string"
      ? latestSyncResult.data.source_observed_at
      : null;
  const jobberDataFresh =
    connection.connected &&
    !latestSyncResult.error &&
    lastJobberSyncAt !== null &&
    !isJobberTodayDataStale(lastJobberSyncAt, reference);
  const warnings: string[] = [];
  if (!connection.connected) {
    warnings.push(
      "Jobber is disconnected. Capacity is unknown until a fresh read-only sync completes.",
    );
  } else if (!jobberDataFresh) {
    warnings.push(
      "The latest Jobber projection is older than six hours or unavailable. Capacity is unknown, not empty.",
    );
  }

  let projections: CapacityProjectionRow[] = [];
  let projectionQueryAvailable = jobberDataFresh;
  if (jobberDataFresh) {
    const projectionResult = await supabase
      .from("jobber_visit_projections")
      .select("scheduled_start, scheduled_end, raw_payload")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .neq("visit_status", "REMOVED")
      .gte("scheduled_start", ranges[0]!.startUtc.toISOString())
      .lt("scheduled_start", ranges.at(-1)!.endUtc.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(PROJECTION_QUERY_LIMIT);
    if (projectionResult.error) {
      projectionQueryAvailable = false;
      warnings.push(
        "The four-week Jobber schedule could not be read. Capacity remains source unavailable.",
      );
    } else if ((projectionResult.data ?? []).length >= PROJECTION_QUERY_LIMIT) {
      projectionQueryAvailable = false;
      warnings.push(
        "The four-week Jobber schedule exceeded the safe read limit. Capacity is unknown rather than undercounted.",
      );
    } else {
      projections = (projectionResult.data ?? []) as CapacityProjectionRow[];
    }
  }

  const identityByUserId = new Map<
    string,
    { displayName: string; mirroredRosterActive: boolean }
  >();
  for (const member of roster.crew) {
    identityByUserId.set(member.jobberUserId, {
      displayName: member.displayName,
      mirroredRosterActive: true,
    });
  }
  for (const plan of plans) {
    if (!identityByUserId.has(plan.jobberUserId)) {
      identityByUserId.set(plan.jobberUserId, {
        displayName: plan.displayName,
        mirroredRosterActive: false,
      });
    }
  }

  const loads = new Map<string, TechnicianWeekLoad>();
  const assignmentUnknownByWeek = new Map<string, number>();
  const scheduledVisitsByWeek = new Map<string, number>();
  const scheduledCrewMinutesByWeek = new Map<string, number>();
  const unassignedStopsByWeek = new Map<string, number>();
  const unassignedMinutesByWeek = new Map<string, number>();
  const globalDurationAvailableByWeek = new Map<string, boolean>();
  const scheduleQueryAvailable = jobberDataFresh && projectionQueryAvailable;
  for (const range of ranges) globalDurationAvailableByWeek.set(range.weekStart, true);

  for (const projection of projections) {
    const scheduledAt = new Date(projection.scheduled_start);
    const range = ranges.find(
      (candidate) =>
        scheduledAt >= candidate.startUtc && scheduledAt < candidate.endUtc,
    );
    if (!range) continue;
    scheduledVisitsByWeek.set(
      range.weekStart,
      (scheduledVisitsByWeek.get(range.weekStart) ?? 0) + 1,
    );
    const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
    if (assignment.assignmentReadState !== "available") {
      assignmentUnknownByWeek.set(
        range.weekStart,
        (assignmentUnknownByWeek.get(range.weekStart) ?? 0) + 1,
      );
      continue;
    }
    const duration = projectionDurationMinutes(projection);
    if (assignment.assignedUsers.length === 0) {
      unassignedStopsByWeek.set(
        range.weekStart,
        (unassignedStopsByWeek.get(range.weekStart) ?? 0) + 1,
      );
      if (duration === null) {
        globalDurationAvailableByWeek.set(range.weekStart, false);
      } else {
        scheduledCrewMinutesByWeek.set(
          range.weekStart,
          (scheduledCrewMinutesByWeek.get(range.weekStart) ?? 0) + duration,
        );
        unassignedMinutesByWeek.set(
          range.weekStart,
          (unassignedMinutesByWeek.get(range.weekStart) ?? 0) + duration,
        );
      }
      continue;
    }
    if (duration !== null) {
      scheduledCrewMinutesByWeek.set(
        range.weekStart,
        (scheduledCrewMinutesByWeek.get(range.weekStart) ?? 0) +
          duration * assignment.assignedUsers.length,
      );
    } else {
      globalDurationAvailableByWeek.set(range.weekStart, false);
    }
    for (const user of assignment.assignedUsers) {
      if (!identityByUserId.has(user.id)) {
        identityByUserId.set(user.id, {
          displayName: user.name,
          mirroredRosterActive: false,
        });
      }
      const loadKey = key(user.id, range.weekStart);
      const existing = loads.get(loadKey) ?? {
        scheduledStops: 0,
        scheduledMinutes: 0,
        durationEvidenceAvailable: true,
      };
      loads.set(loadKey, {
        scheduledStops: existing.scheduledStops + 1,
        scheduledMinutes:
          existing.scheduledMinutes + (duration === null ? 0 : duration),
        durationEvidenceAvailable:
          existing.durationEvidenceAvailable && duration !== null,
      });
    }
  }

  const technicians: TechnicianCapacityView[] = [
    ...identityByUserId.entries(),
  ]
    .map(([jobberUserId, identity]) => ({
      jobberUserId,
      displayName: identity.displayName,
      mirroredRosterActive: identity.mirroredRosterActive,
      weeks: ranges.map((range) => {
        const load = loads.get(key(jobberUserId, range.weekStart)) ?? {
          scheduledStops: 0,
          scheduledMinutes: 0,
          durationEvidenceAvailable: true,
        };
        return deriveTechnicianCapacityWeek({
          weekStart: range.weekStart,
          weekEndExclusive: range.weekEndExclusive,
          plan: planForWeek(plans, jobberUserId, range.weekStart),
          sourceAvailable:
            scheduleQueryAvailable &&
            (assignmentUnknownByWeek.get(range.weekStart) ?? 0) === 0 &&
            load.durationEvidenceAvailable,
          scheduledStops: load.scheduledStops,
          scheduledMinutes: load.scheduledMinutes,
        });
      }),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const weeks: TechnicianCapacityWeekDemand[] = ranges.map((range) => {
    const assignmentUnknownStops =
      assignmentUnknownByWeek.get(range.weekStart) ?? 0;
    const sourceAvailable =
      scheduleQueryAvailable &&
      assignmentUnknownStops === 0 &&
      globalDurationAvailableByWeek.get(range.weekStart) === true;
    const activeTechnicians = technicians.filter(
      (technician) => technician.mirroredRosterActive,
    );
    const weekForecasts = activeTechnicians.map(
      (technician) =>
        technician.weeks.find((week) => week.weekStart === range.weekStart)!,
    );
    const everyCapacityDeclared =
      activeTechnicians.length > 0 &&
      weekForecasts.every((forecast) => forecast.capacityMinutes !== null);
    const declaredCapacityMinutes = everyCapacityDeclared
      ? weekForecasts.reduce(
          (sum, forecast) => sum + (forecast.capacityMinutes ?? 0),
          0,
        )
      : null;
    const scheduledCrewMinutes = sourceAvailable
      ? (scheduledCrewMinutesByWeek.get(range.weekStart) ?? 0)
      : null;
    return {
      weekStart: range.weekStart,
      weekEndExclusive: range.weekEndExclusive,
      sourceAvailable,
      scheduledVisits: sourceAvailable
        ? (scheduledVisitsByWeek.get(range.weekStart) ?? 0)
        : null,
      scheduledCrewMinutes,
      declaredCapacityMinutes,
      remainingCrewMinutes:
        sourceAvailable &&
        declaredCapacityMinutes !== null &&
        scheduledCrewMinutes !== null
          ? declaredCapacityMinutes - scheduledCrewMinutes
          : null,
      unassignedStops: sourceAvailable
        ? (unassignedStopsByWeek.get(range.weekStart) ?? 0)
        : null,
      unassignedMinutes: sourceAvailable
        ? (unassignedMinutesByWeek.get(range.weekStart) ?? 0)
        : null,
      assignmentUnknownStops,
    };
  });

  if (
    weeks.some(
      (week) => !week.sourceAvailable && week.assignmentUnknownStops > 0,
    )
  ) {
    warnings.push(
      "At least one scheduled visit has unreadable crew assignment. Affected weekly capacity fails closed.",
    );
  }
  if (weeks.some((week) => !week.sourceAvailable) && jobberDataFresh) {
    warnings.push(
      "At least one scheduled visit lacks a usable duration or assignment. Affected capacity is unknown, not zero.",
    );
  }
  if (
    technicians.some(
      (technician) =>
        !technician.mirroredRosterActive &&
        technician.weeks.some((week) => (week.scheduledStops ?? 0) > 0),
    )
  ) {
    warnings.push(
      "Scheduled work references a technician outside the current mirrored roster. Reconcile the roster before declaring team capacity complete.",
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    today: formatBusinessCalendarDate(reference),
    schemaAvailable: true,
    jobberConnected: connection.connected,
    jobberStatus: connection.status,
    jobberDataFresh,
    lastJobberSyncAt,
    technicians,
    weeks,
    warnings: [...new Set(warnings)],
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

function samePlan(
  plan: TechnicianCapacityPlan,
  input: RecordTechnicianCapacityPlanInput,
): boolean {
  return (
    plan.jobberUserId === input.jobberUserId &&
    plan.displayName === input.displayName &&
    plan.effectiveWeekStart === input.effectiveWeekStart &&
    plan.weeklyCapacityMinutes === input.weeklyCapacityMinutes &&
    plan.planningHourlyCostCents === input.planningHourlyCostCents &&
    (plan.notes ?? "") === (input.notes?.trim() ?? "")
  );
}

export async function recordTechnicianCapacityPlan(
  input: RecordTechnicianCapacityPlanInput,
  reference: Date = new Date(),
): Promise<TechnicianCapacityPlan> {
  const validationError = validateTechnicianCapacityPlanInput(input);
  if (validationError) throw new Error(validationError);
  if (!isRealCalendarDate(input.effectiveWeekStart) || !isMonday(input.effectiveWeekStart)) {
    throw new Error("Capacity plans must begin on a real Monday business week.");
  }
  const allowedWeeks = new Set(
    weekRanges(reference, 9).map((range) => range.weekStart),
  );
  if (!allowedWeeks.has(input.effectiveWeekStart)) {
    throw new Error("Choose the current week or one of the next eight weeks.");
  }
  const technician = await resolveMirroredTechnician(input);
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("technician_capacity_plans")
    .select(PLAN_SELECT)
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();
  if (existing.error && isMissingTechnicianCapacitySchema(existing.error)) {
    throw new Error("Apply HomeAtlas migration 063 before saving capacity plans.");
  }
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const plan = toPlan(existing.data as TechnicianCapacityPlanRow);
    if (!samePlan(plan, input)) {
      throw new Error("That capacity request ID is already bound to another plan.");
    }
    return plan;
  }

  const saved = await supabase
    .from("technician_capacity_plans")
    .insert({
      client_request_id: input.clientRequestId,
      jobber_user_id: technician.jobberUserId,
      display_name: technician.displayName,
      effective_week_start: input.effectiveWeekStart,
      weekly_capacity_minutes: input.weeklyCapacityMinutes,
      planning_hourly_cost_cents: input.planningHourlyCostCents,
      notes: input.notes?.trim() || null,
      recorded_by: "HomeAtlas HQ",
    })
    .select(PLAN_SELECT)
    .single();
  if (saved.error || !saved.data) {
    if (isMissingTechnicianCapacitySchema(saved.error)) {
      throw new Error("Apply HomeAtlas migration 063 before saving capacity plans.");
    }
    if (saved.error?.code === "23505") {
      const replay = await supabase
        .from("technician_capacity_plans")
        .select(PLAN_SELECT)
        .eq("client_request_id", input.clientRequestId)
        .maybeSingle();
      if (replay.data) {
        const plan = toPlan(replay.data as TechnicianCapacityPlanRow);
        if (samePlan(plan, input)) return plan;
      }
    }
    throw new Error(saved.error?.message ?? "Could not save the capacity plan.");
  }
  return toPlan(saved.data as TechnicianCapacityPlanRow);
}
