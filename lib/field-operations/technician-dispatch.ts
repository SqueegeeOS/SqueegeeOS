import type {
  JobberTodayData,
  JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import { jobberTodayVisitAnchorId } from "@/lib/care-operations/jobber-today-links";
import type {
  TechnicianAccessGrantView,
  TechnicianRosterMember,
} from "./field-access";
import {
  resolveTechnicianVisitReadiness,
  selectTechnicianNextAction,
  type TechnicianVisitReadiness,
} from "./technician-run";
import type { TechnicianVisitStage } from "./technician-visit-events";

const FIELD_PASS_EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1_000;

const ACTIVE_FIELD_STAGES = new Set<TechnicianVisitStage>([
  "en_route",
  "arrived",
  "service_started",
  "service_completed",
]);

const DISPATCH_STATE_PRIORITY: Record<TechnicianDispatchState, number> = {
  attention: 0,
  working: 1,
  ready: 2,
  done: 3,
  off_route: 4,
};

export type TechnicianFieldPassState =
  | "active"
  | "expiring"
  | "pending"
  | "expired"
  | "revoked"
  | "missing";

export type TechnicianDispatchState =
  | "attention"
  | "working"
  | "ready"
  | "done"
  | "off_route";

export interface TechnicianDispatchStop {
  projectionId: string;
  todayHref: string;
  clientName: string;
  serviceLabel: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  fieldStage: TechnicianVisitStage;
  fieldStageAt: string | null;
  readiness: TechnicianVisitReadiness;
  jobberComplete: boolean;
}

export interface TechnicianDispatchCrewMember {
  jobberUserId: string;
  displayName: string;
  fieldPassState: TechnicianFieldPassState;
  fieldPassExpiresAt: string | null;
  dispatchState: TechnicianDispatchState;
  assignedStopCount: number;
  jobberCompleteStopCount: number;
  documentedStopCount: number;
  portalUpdatedStopCount: number;
  actionRequiredStopCount: number;
  attentionStop: TechnicianDispatchStop | null;
  activeStop: TechnicianDispatchStop | null;
  nextStop: TechnicianDispatchStop | null;
}

export interface TechnicianDispatchSummary {
  scheduledStops: number;
  scheduledCrew: number;
  activeCrew: number;
  readyCrew: number;
  attentionCrew: number;
  doneCrew: number;
  crewWithoutUsablePass: number;
  unassignedStops: number;
  assignmentUnknownStops: number;
}

export interface TechnicianDispatchBoard {
  loadedAt: string;
  calendarDate: string;
  timezone: string;
  fieldRecordStatusAvailable: boolean;
  fieldEventStatusAvailable: boolean;
  summary: TechnicianDispatchSummary;
  crew: TechnicianDispatchCrewMember[];
}

function validInstant(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveTechnicianFieldPassState(
  grant: TechnicianAccessGrantView | null,
  referenceDate: Date = new Date(),
): TechnicianFieldPassState {
  if (!grant) return "missing";
  if (grant.status === "revoked") return "revoked";

  if (grant.status === "pending") {
    const inviteExpiresAt = validInstant(grant.inviteExpiresAt);
    return inviteExpiresAt !== null && inviteExpiresAt > referenceDate.getTime()
      ? "pending"
      : "expired";
  }

  const sessionExpiresAt = validInstant(grant.sessionExpiresAt);
  if (
    sessionExpiresAt === null ||
    sessionExpiresAt <= referenceDate.getTime()
  ) {
    return "expired";
  }
  return sessionExpiresAt - referenceDate.getTime() <=
    FIELD_PASS_EXPIRING_SOON_MS
    ? "expiring"
    : "active";
}

export function isTechnicianFieldPassUsable(
  state: TechnicianFieldPassState,
): boolean {
  return state === "active" || state === "expiring";
}

function isVisitAssignedToUser(
  visit: JobberTodayVisit,
  jobberUserId: string,
): boolean {
  return (
    visit.assignmentReadState === "available" &&
    visit.assignedUsers.some((user) => user.id === jobberUserId)
  );
}

function dispatchStop(visit: JobberTodayVisit): TechnicianDispatchStop {
  return {
    projectionId: visit.projectionId,
    todayHref: `/hq/today#${jobberTodayVisitAnchorId(visit.projectionId)}`,
    clientName: visit.clientName,
    serviceLabel: visit.title?.trim() || "Scheduled Jobber service",
    scheduledStart: visit.scheduledStart,
    scheduledEnd: visit.scheduledEnd,
    fieldStage: visit.homeAtlasFieldStage,
    fieldStageAt: visit.homeAtlasFieldStageAt,
    readiness: "ready",
    jobberComplete: visit.isComplete,
  };
}

function withReadiness(
  visit: JobberTodayVisit,
  fieldRecordStatusAvailable: boolean,
): TechnicianDispatchStop {
  return {
    ...dispatchStop(visit),
    readiness: resolveTechnicianVisitReadiness(
      visit,
      fieldRecordStatusAvailable,
    ),
  };
}

function selectActiveVisit(visits: JobberTodayVisit[]): JobberTodayVisit | null {
  let selected: JobberTodayVisit | null = null;
  let selectedTime = Number.NEGATIVE_INFINITY;
  for (const visit of visits) {
    if (!ACTIVE_FIELD_STAGES.has(visit.homeAtlasFieldStage)) continue;
    const stageTime = validInstant(visit.homeAtlasFieldStageAt) ?? 0;
    if (stageTime >= selectedTime) {
      selected = visit;
      selectedTime = stageTime;
    }
  }
  return selected;
}

function selectAttentionVisit(
  visits: JobberTodayVisit[],
  readinessByProjectionId: Map<string, TechnicianVisitReadiness>,
): JobberTodayVisit | null {
  let selected: JobberTodayVisit | null = null;
  let selectedTime = Number.POSITIVE_INFINITY;
  for (const visit of visits) {
    const readiness = readinessByProjectionId.get(visit.projectionId);
    if (!readiness || readiness === "ready" || readiness === "complete") {
      continue;
    }
    const scheduledAt = validInstant(visit.scheduledStart) ?? selectedTime;
    if (scheduledAt <= selectedTime) {
      selected = visit;
      selectedTime = scheduledAt;
    }
  }
  return selected;
}

function crewUnion(
  roster: TechnicianRosterMember[],
  visits: JobberTodayVisit[],
): TechnicianRosterMember[] {
  const byUserId = new Map(
    roster.map((member) => [member.jobberUserId, member]),
  );
  for (const visit of visits) {
    if (visit.assignmentReadState !== "available") continue;
    for (const user of visit.assignedUsers) {
      if (byUserId.has(user.id)) continue;
      byUserId.set(user.id, {
        jobberUserId: user.id,
        displayName: user.name,
        observedStopCount: 1,
        latestObservedAt: visit.scheduledStart,
        currentGrant: null,
      });
    }
  }
  return [...byUserId.values()];
}

function buildCrewMember(input: {
  member: TechnicianRosterMember;
  visits: JobberTodayVisit[];
  fieldRecordStatusAvailable: boolean;
  referenceDate: Date;
}): TechnicianDispatchCrewMember {
  const assignedVisits = input.visits.filter((visit) =>
    isVisitAssignedToUser(visit, input.member.jobberUserId),
  );
  const readinessByProjectionId = new Map(
    assignedVisits.map((visit) => [
      visit.projectionId,
      resolveTechnicianVisitReadiness(
        visit,
        input.fieldRecordStatusAvailable,
      ),
    ]),
  );
  const actionRequiredStopCount = [...readinessByProjectionId.values()].filter(
    (readiness) => readiness !== "ready" && readiness !== "complete",
  ).length;
  const fieldPassState = resolveTechnicianFieldPassState(
    input.member.currentGrant,
    input.referenceDate,
  );
  const usablePass = isTechnicianFieldPassUsable(fieldPassState);
  const activeVisit = selectActiveVisit(assignedVisits);
  const attentionVisit = selectAttentionVisit(
    assignedVisits,
    readinessByProjectionId,
  );
  const nextVisit = selectTechnicianNextAction(
    assignedVisits,
    input.fieldRecordStatusAvailable,
  );

  let dispatchState: TechnicianDispatchState = "off_route";
  if (
    actionRequiredStopCount > 0 ||
    (assignedVisits.length > 0 && !usablePass)
  ) {
    dispatchState = "attention";
  } else if (activeVisit) {
    dispatchState = "working";
  } else if (assignedVisits.length > 0) {
    dispatchState = assignedVisits.every(
      (visit) => readinessByProjectionId.get(visit.projectionId) === "complete",
    )
      ? "done"
      : "ready";
  }

  return {
    jobberUserId: input.member.jobberUserId,
    displayName: input.member.displayName,
    fieldPassState,
    fieldPassExpiresAt:
      input.member.currentGrant?.sessionExpiresAt ??
      input.member.currentGrant?.inviteExpiresAt ??
      null,
    dispatchState,
    assignedStopCount: assignedVisits.length,
    jobberCompleteStopCount: assignedVisits.filter((visit) => visit.isComplete)
      .length,
    documentedStopCount: assignedVisits.filter(
      (visit) => visit.homeAtlasFieldRecordCount > 0,
    ).length,
    portalUpdatedStopCount: assignedVisits.filter(
      (visit) => visit.homeAtlasCustomerVisibleRecordCount > 0,
    ).length,
    actionRequiredStopCount,
    attentionStop: attentionVisit
      ? withReadiness(attentionVisit, input.fieldRecordStatusAvailable)
      : null,
    activeStop: activeVisit
      ? withReadiness(activeVisit, input.fieldRecordStatusAvailable)
      : null,
    nextStop: nextVisit
      ? withReadiness(nextVisit, input.fieldRecordStatusAvailable)
      : null,
  };
}

export function buildTechnicianDispatchBoard(input: {
  roster: TechnicianRosterMember[];
  today: JobberTodayData;
  referenceDate?: Date;
}): TechnicianDispatchBoard {
  const referenceDate = input.referenceDate ?? new Date(input.today.loadedAt);
  const crew = crewUnion(input.roster, input.today.visits)
    .map((member) =>
      buildCrewMember({
        member,
        visits: input.today.visits,
        fieldRecordStatusAvailable: input.today.fieldRecordStatusAvailable,
        referenceDate,
      }),
    )
    .sort((left, right) => {
      const stateDifference =
        DISPATCH_STATE_PRIORITY[left.dispatchState] -
        DISPATCH_STATE_PRIORITY[right.dispatchState];
      return stateDifference !== 0
        ? stateDifference
        : left.displayName.localeCompare(right.displayName, "en-US");
    });

  const scheduledCrew = crew.filter(
    (member) => member.assignedStopCount > 0,
  );
  return {
    loadedAt: input.today.loadedAt,
    calendarDate: input.today.calendarDate,
    timezone: input.today.timezone,
    fieldRecordStatusAvailable: input.today.fieldRecordStatusAvailable,
    fieldEventStatusAvailable: input.today.fieldEventStatusAvailable,
    summary: {
      scheduledStops: input.today.summary.total,
      scheduledCrew: scheduledCrew.length,
      activeCrew: crew.filter((member) => member.activeStop !== null).length,
      readyCrew: crew.filter((member) => member.dispatchState === "ready")
        .length,
      attentionCrew: crew.filter(
        (member) => member.dispatchState === "attention",
      ).length,
      doneCrew: crew.filter((member) => member.dispatchState === "done").length,
      crewWithoutUsablePass: scheduledCrew.filter(
        (member) => !isTechnicianFieldPassUsable(member.fieldPassState),
      ).length,
      unassignedStops: input.today.summary.unassigned,
      assignmentUnknownStops: input.today.summary.assignmentUnknown,
    },
    crew,
  };
}
