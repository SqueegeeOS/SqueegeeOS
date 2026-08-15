import type { VisitFieldFollowUpView } from "@/lib/field-records/visit-field-record";

export type JobberTodayVisitMoment =
  | "complete"
  | "in_progress"
  | "late"
  | "upcoming";

export type JobberTodayAssignmentReadState =
  | "available"
  | "permission_hidden"
  | "not_observed";

export interface JobberTodayAssignedUser {
  id: string;
  name: string;
}

function assignmentString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readJobberTodayVisitAssignment(value: unknown): Pick<
  JobberTodayVisit,
  "assignedUsers" | "assignmentReadState"
> {
  if (!value || typeof value !== "object") {
    return { assignedUsers: [], assignmentReadState: "not_observed" };
  }

  const payload = value as Record<string, unknown>;
  if (payload.assignmentReadState === "permission_hidden") {
    return { assignedUsers: [], assignmentReadState: "permission_hidden" };
  }

  const assignedValue = payload.assignedUsers;
  const assignedNodes = Array.isArray(assignedValue)
    ? assignedValue
    : assignedValue &&
        typeof assignedValue === "object" &&
        Array.isArray((assignedValue as Record<string, unknown>).nodes)
      ? ((assignedValue as Record<string, unknown>).nodes as unknown[])
      : null;
  if (!assignedNodes) {
    return { assignedUsers: [], assignmentReadState: "not_observed" };
  }

  const users = new Map<string, string>();
  for (const candidate of assignedNodes) {
    if (!candidate || typeof candidate !== "object") continue;
    const user = candidate as Record<string, unknown>;
    const id = assignmentString(user.id);
    const nameValue = user.name;
    const name =
      assignmentString(nameValue) ??
      (nameValue && typeof nameValue === "object"
        ? assignmentString((nameValue as Record<string, unknown>).full)
        : null);
    if (id && name) users.set(id, name);
  }

  return {
    assignedUsers: [...users].map(([id, name]) => ({ id, name })),
    assignmentReadState: "available",
  };
}

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
  assignedUsers: JobberTodayAssignedUser[];
  assignmentReadState: JobberTodayAssignmentReadState;
  propertyLabel: string | null;
  jobberPropertyWebUri: string | null;
  jobberClientWebUri: string | null;
  homeAtlasPropertyId: string | null;
  homeAtlasAppointmentId: string | null;
  homeAtlasMembershipId: string | null;
  homeAtlasPortalPath: string | null;
  homeAtlasFieldRecordCount: number;
  homeAtlasLatestFieldRecordAt: string | null;
  homeAtlasLatestFieldRecordBy: string | null;
  homeAtlasCustomerVisibleRecordCount: number;
}

export interface JobberTodayPropertyLink {
  externalPropertyId: string;
  propertyId: string;
  membershipId: string;
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
  assigned: number;
  unassigned: number;
  assignmentUnknown: number;
}

export function summarizeJobberTodayVisits(
  visits: Array<
    Pick<
      JobberTodayVisit,
      | "isComplete"
      | "homeAtlasFieldRecordCount"
      | "homeAtlasCustomerVisibleRecordCount"
      | "assignedUsers"
      | "assignmentReadState"
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
  const assigned = visits.filter(
    (visit) =>
      visit.assignmentReadState === "available" &&
      visit.assignedUsers.length > 0,
  ).length;
  const unassigned = visits.filter(
    (visit) =>
      visit.assignmentReadState === "available" &&
      visit.assignedUsers.length === 0,
  ).length;
  const assignmentUnknown = visits.filter(
    (visit) => visit.assignmentReadState !== "available",
  ).length;
  return {
    total: visits.length,
    complete,
    remaining: visits.length - complete,
    documented,
    portalUpdated,
    completedWithoutRecord,
    completedWithPrivateOnlyRecord,
    assigned,
    unassigned,
    assignmentUnknown,
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
  homeAtlasMembershipId: string | null;
} {
  const property = input.propertyLinks.find(
    (link) => link.externalPropertyId === input.externalPropertyId,
  );
  if (!property) {
    return {
      homeAtlasPropertyId: null,
      homeAtlasAppointmentId: null,
      homeAtlasMembershipId: null,
    };
  }

  const appointment = input.appointmentLinks.find(
    (link) =>
      link.externalVisitId === input.externalVisitId &&
      link.propertyId === property.propertyId,
  );
  return {
    homeAtlasPropertyId: property.propertyId,
    homeAtlasAppointmentId: appointment?.appointmentId ?? null,
    homeAtlasMembershipId: property.membershipId,
  };
}
