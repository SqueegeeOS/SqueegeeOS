import {
  hasNativeJobberVisitAssignment,
  jobberVisitNeedsCustomerPortalUpdate,
  type JobberTodayAssignedUser,
  type JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";

export type TechnicianVisitReadiness =
  | "ready"
  | "complete"
  | "closeout_required"
  | "portal_update_required"
  | "follow_up_open"
  | "pairing_required"
  | "appointment_syncing"
  | "proof_unavailable"
  | "jobber_completion_pending";

type TechnicianVisitInput = Pick<
  JobberTodayVisit,
  | "isComplete"
  | "scheduledStart"
  | "homeAtlasPropertyId"
  | "homeAtlasAppointmentId"
  | "homeAtlasFieldRecordCount"
  | "homeAtlasCustomerVisibleRecordCount"
  | "homeAtlasOpenFollowUpCount"
  | "homeAtlasFieldStage"
> & { homeAtlasFieldAssignmentId?: string | null };

export interface TechnicianRunSummary {
  total: number;
  ready: number;
  complete: number;
  actionRequired: number;
  documented: number;
}

export interface TechnicianCrewMember extends JobberTodayAssignedUser {
  stopCount: number;
}

export const TECHNICIAN_ALL_CREW = "all";
export const TECHNICIAN_UNASSIGNED_CREW = "unassigned";

type TechnicianAssignmentInput = Pick<
  JobberTodayVisit,
  "assignedUsers" | "assignmentReadState"
> & Partial<Pick<JobberTodayVisit,
  "homeAtlasFieldAssignmentId" | "homeAtlasAssignedTechnicianId" | "homeAtlasAssignedTechnicianName"
>>;

function effectiveTechnicianCrew(visit: TechnicianAssignmentInput): JobberTodayAssignedUser[] {
  if (hasNativeJobberVisitAssignment(visit) && visit.homeAtlasAssignedTechnicianId) {
    return [{ id: visit.homeAtlasAssignedTechnicianId, name: visit.homeAtlasAssignedTechnicianName || "Assigned technician" }];
  }
  return visit.assignmentReadState === "available" ? visit.assignedUsers : [];
}

export function technicianCrewSelection(userId: string): string {
  return `user:${userId}`;
}

export function listTechnicianCrew(
  visits: TechnicianAssignmentInput[],
): TechnicianCrewMember[] {
  const crew = new Map<string, TechnicianCrewMember>();
  for (const visit of visits) {
    const seenOnVisit = new Set<string>();
    for (const user of effectiveTechnicianCrew(visit)) {
      if (seenOnVisit.has(user.id)) continue;
      seenOnVisit.add(user.id);
      const existing = crew.get(user.id);
      crew.set(user.id, {
        id: user.id,
        name: user.name,
        stopCount: (existing?.stopCount ?? 0) + 1,
      });
    }
  }
  return [...crew.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "en-US"),
  );
}

export function filterTechnicianVisits<T extends TechnicianAssignmentInput>(
  visits: T[],
  crewSelection: string,
): T[] {
  if (crewSelection === TECHNICIAN_ALL_CREW) return visits;
  if (crewSelection === TECHNICIAN_UNASSIGNED_CREW) {
    return visits.filter(
      (visit) =>
        !hasNativeJobberVisitAssignment(visit) && visit.assignmentReadState === "available" &&
        visit.assignedUsers.length === 0,
    );
  }
  if (!crewSelection.startsWith("user:")) return visits;
  const userId = crewSelection.slice("user:".length);
  if (!userId) return visits;
  return visits.filter((visit) =>
    effectiveTechnicianCrew(visit).some((user) => user.id === userId),
  );
}

export function resolveTechnicianVisitReadiness(
  visit: TechnicianVisitInput,
  fieldRecordStatusAvailable: boolean,
): TechnicianVisitReadiness {
  if (!visit.homeAtlasFieldAssignmentId && !visit.homeAtlasPropertyId) return "pairing_required";
  if (!visit.homeAtlasFieldAssignmentId && !visit.homeAtlasAppointmentId) return "appointment_syncing";
  if (!fieldRecordStatusAvailable) return "proof_unavailable";
  if (visit.homeAtlasFieldStage === "departed" && !visit.isComplete) {
    return "jobber_completion_pending";
  }
  if (visit.isComplete && visit.homeAtlasFieldRecordCount === 0) {
    return "closeout_required";
  }
  if (visit.homeAtlasOpenFollowUpCount > 0) return "follow_up_open";
  if (jobberVisitNeedsCustomerPortalUpdate(visit)) {
    return "portal_update_required";
  }
  if (visit.isComplete) return "complete";
  return "ready";
}

export function summarizeTechnicianRun(
  visits: TechnicianVisitInput[],
  fieldRecordStatusAvailable: boolean,
): TechnicianRunSummary {
  const summary: TechnicianRunSummary = {
    total: visits.length,
    ready: 0,
    complete: 0,
    actionRequired: 0,
    documented: 0,
  };

  for (const visit of visits) {
    const readiness = resolveTechnicianVisitReadiness(
      visit,
      fieldRecordStatusAvailable,
    );
    if (readiness === "ready") summary.ready += 1;
    if (readiness === "complete") summary.complete += 1;
    if (
      readiness !== "ready" &&
      readiness !== "complete"
    ) {
      summary.actionRequired += 1;
    }
    if (visit.homeAtlasFieldRecordCount > 0) summary.documented += 1;
  }

  return summary;
}

export function selectTechnicianNextAction<T extends TechnicianVisitInput>(
  visits: T[],
  fieldRecordStatusAvailable: boolean,
): T | null {
  let oldestUnfinished: T | null = null;
  let oldestUnfinishedTime = Number.POSITIVE_INFINITY;
  let oldestCloseout: T | null = null;
  let oldestCloseoutTime = Number.POSITIVE_INFINITY;
  let activeRoute: T | null = null;
  let activeRouteTime = Number.POSITIVE_INFINITY;

  for (const visit of visits) {
    const scheduledAt = new Date(visit.scheduledStart).getTime();
    const time = Number.isFinite(scheduledAt)
      ? scheduledAt
      : Number.POSITIVE_INFINITY;
    const readiness = resolveTechnicianVisitReadiness(
      visit,
      fieldRecordStatusAvailable,
    );

    if (
      (readiness === "closeout_required" ||
        readiness === "portal_update_required" ||
        readiness === "follow_up_open") &&
      time < oldestCloseoutTime
    ) {
      oldestCloseout = visit;
      oldestCloseoutTime = time;
    }
    if (
      visit.homeAtlasFieldStage !== "not_started" &&
      visit.homeAtlasFieldStage !== "departed" &&
      time < activeRouteTime
    ) {
      activeRoute = visit;
      activeRouteTime = time;
    }
    if (
      !visit.isComplete &&
      visit.homeAtlasFieldStage !== "departed" &&
      time < oldestUnfinishedTime
    ) {
      oldestUnfinished = visit;
      oldestUnfinishedTime = time;
    }
  }

  return oldestCloseout ?? activeRoute ?? oldestUnfinished;
}
