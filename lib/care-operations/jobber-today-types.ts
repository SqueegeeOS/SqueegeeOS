import type { VisitFieldFollowUpView } from "@/lib/field-records/visit-field-record";

export type JobberTodayVisitMoment =
  | "complete"
  | "in_progress"
  | "late"
  | "upcoming";

export interface JobberTodayVisit {
  projectionId: string;
  externalVisitId: string;
  clientName: string;
  title: string | null;
  jobNumber: number | null;
  visitStatus: string;
  jobStatus: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  isComplete: boolean;
  propertyLabel: string | null;
  jobberPropertyWebUri: string | null;
  jobberClientWebUri: string | null;
  homeAtlasPropertyId: string | null;
  homeAtlasAppointmentId: string | null;
  homeAtlasFieldRecordCount: number;
  homeAtlasLatestFieldRecordAt: string | null;
  homeAtlasLatestFieldRecordBy: string | null;
  homeAtlasCustomerVisibleRecordCount: number;
}

export interface JobberTodayPropertyLink {
  externalPropertyId: string;
  propertyId: string;
}

export interface JobberTodayAppointmentLink {
  externalVisitId: string;
  propertyId: string;
  appointmentId: string;
}

export interface JobberTodayData {
  calendarDate: string;
  timezone: string;
  connected: boolean;
  connectionStatus: string;
  accountName: string | null;
  lastSyncedAt: string | null;
  loadedAt: string;
  fieldRecordStatusAvailable: boolean;
  summary: JobberTodaySummary;
  visits: JobberTodayVisit[];
  fieldFollowUps: VisitFieldFollowUpView[];
}

export interface JobberTodaySummary {
  total: number;
  complete: number;
  remaining: number;
  documented: number;
  portalUpdated: number;
  completedWithoutRecord: number;
  completedWithPrivateOnlyRecord: number;
}

export function summarizeJobberTodayVisits(
  visits: Array<
    Pick<
      JobberTodayVisit,
      | "isComplete"
      | "homeAtlasFieldRecordCount"
      | "homeAtlasCustomerVisibleRecordCount"
    >
  >,
): JobberTodaySummary {
  const complete = visits.filter((visit) => visit.isComplete).length;
  const documented = visits.filter(
    (visit) => visit.homeAtlasFieldRecordCount > 0,
  ).length;
  const completedWithoutRecord = visits.filter(
    (visit) => visit.isComplete && visit.homeAtlasFieldRecordCount === 0,
  ).length;
  const portalUpdated = visits.filter(
    (visit) => visit.homeAtlasCustomerVisibleRecordCount > 0,
  ).length;
  const completedWithPrivateOnlyRecord = visits.filter(
    (visit) =>
      visit.isComplete &&
      visit.homeAtlasFieldRecordCount > 0 &&
      visit.homeAtlasCustomerVisibleRecordCount === 0,
  ).length;
  return {
    total: visits.length,
    complete,
    remaining: visits.length - complete,
    documented,
    portalUpdated,
    completedWithoutRecord,
    completedWithPrivateOnlyRecord,
  };
}

export function classifyJobberTodayVisit(
  visit: Pick<
    JobberTodayVisit,
    "isComplete" | "scheduledStart" | "scheduledEnd"
  >,
  now: Date = new Date(),
): JobberTodayVisitMoment {
  if (visit.isComplete) return "complete";

  const start = new Date(visit.scheduledStart).getTime();
  const end = visit.scheduledEnd
    ? new Date(visit.scheduledEnd).getTime()
    : null;
  const current = now.getTime();

  if (start > current) return "upcoming";
  if (end !== null && end < current) return "late";
  return "in_progress";
}

export function isJobberTodayDataStale(
  lastSyncedAt: string | null,
  now: Date = new Date(),
  staleAfterMs = 6 * 60 * 60 * 1_000,
): boolean {
  if (!lastSyncedAt) return true;
  const synchronizedAt = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(synchronizedAt)) return true;
  return now.getTime() - synchronizedAt > staleAfterMs;
}

export function resolveJobberTodayHomeAtlasContext(input: {
  externalPropertyId: string;
  externalVisitId: string;
  propertyLinks: JobberTodayPropertyLink[];
  appointmentLinks: JobberTodayAppointmentLink[];
}): {
  homeAtlasPropertyId: string | null;
  homeAtlasAppointmentId: string | null;
} {
  const property = input.propertyLinks.find(
    (link) => link.externalPropertyId === input.externalPropertyId,
  );
  if (!property) {
    return { homeAtlasPropertyId: null, homeAtlasAppointmentId: null };
  }

  const appointment = input.appointmentLinks.find(
    (link) =>
      link.externalVisitId === input.externalVisitId &&
      link.propertyId === property.propertyId,
  );
  return {
    homeAtlasPropertyId: property.propertyId,
    homeAtlasAppointmentId: appointment?.appointmentId ?? null,
  };
}
