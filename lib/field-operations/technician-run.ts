import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";

export type TechnicianVisitReadiness =
  | "ready"
  | "complete"
  | "closeout_required"
  | "portal_update_required"
  | "pairing_required"
  | "appointment_syncing"
  | "proof_unavailable";

type TechnicianVisitInput = Pick<
  JobberTodayVisit,
  | "isComplete"
  | "scheduledStart"
  | "homeAtlasPropertyId"
  | "homeAtlasAppointmentId"
  | "homeAtlasFieldRecordCount"
  | "homeAtlasCustomerVisibleRecordCount"
>;

export interface TechnicianRunSummary {
  total: number;
  ready: number;
  complete: number;
  actionRequired: number;
  documented: number;
}

export function resolveTechnicianVisitReadiness(
  visit: TechnicianVisitInput,
  fieldRecordStatusAvailable: boolean,
): TechnicianVisitReadiness {
  if (!visit.homeAtlasPropertyId) return "pairing_required";
  if (!visit.homeAtlasAppointmentId) return "appointment_syncing";
  if (!fieldRecordStatusAvailable) return "proof_unavailable";
  if (visit.isComplete && visit.homeAtlasFieldRecordCount === 0) {
    return "closeout_required";
  }
  if (
    visit.isComplete &&
    visit.homeAtlasFieldRecordCount > 0 &&
    visit.homeAtlasCustomerVisibleRecordCount === 0
  ) {
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
        readiness === "portal_update_required") &&
      time < oldestCloseoutTime
    ) {
      oldestCloseout = visit;
      oldestCloseoutTime = time;
    }
    if (!visit.isComplete && time < oldestUnfinishedTime) {
      oldestUnfinished = visit;
      oldestUnfinishedTime = time;
    }
  }

  return oldestCloseout ?? oldestUnfinished;
}
