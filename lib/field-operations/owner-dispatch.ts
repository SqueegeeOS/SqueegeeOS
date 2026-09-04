import {
  COMPANY_BUSINESS_TIMEZONE,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import {
  readJobberTodayVisitAssignment,
  readJobberTodayVisitScope,
  type JobberTodayAssignmentReadState,
  type JobberTodayAssignedUser,
  type JobberTodayScopeItem,
} from "@/lib/care-operations/jobber-today-types";

export const OWNER_DISPATCH_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface OwnerDispatchCoordinate {
  latitude: number;
  longitude: number;
}

export interface OwnerDispatchVisit {
  projectionId: string;
  externalVisitId: string;
  externalPropertyId: string;
  clientName: string;
  serviceLabel: string;
  jobNumber: number | null;
  visitStatus: string;
  jobStatus: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  isComplete: boolean;
  assignedUsers: JobberTodayAssignedUser[];
  homeAtlasAssignedTechnician: JobberTodayAssignedUser | null;
  homeAtlasFieldAssignmentId: string | null;
  assignmentReadState: JobberTodayAssignmentReadState;
  scopeItems: JobberTodayScopeItem[];
  address: string | null;
  city: string | null;
  location: OwnerDispatchCoordinate | null;
  jobberPropertyWebUri: string | null;
  homeAtlasVisitHref: string;
}

export interface OwnerDispatchCrewMember {
  jobberUserId: string;
  displayName: string;
  visitCount: number;
  scheduledMinutes: number;
}

export interface OwnerDispatchAssignableUser {
  id: string;
  name: string;
  source: "jobber" | "homeatlas";
  availableForScheduling: boolean;
  isAccountOwner: boolean;
  isAccountAdmin: boolean;
}

export type OwnerDispatchAssignmentCapability =
  | "available"
  | "permission_required"
  | "unavailable";

export interface OwnerDispatchPayload {
  month: string;
  timezone: string;
  generatedAt: string;
  connected: boolean;
  connectionStatus: string;
  accountName: string | null;
  lastSyncedAt: string | null;
  visits: OwnerDispatchVisit[];
  crew: OwnerDispatchCrewMember[];
  assignableUsers: OwnerDispatchAssignableUser[];
  assignmentCapability: OwnerDispatchAssignmentCapability;
  assignmentMessage: string | null;
  summary: {
    total: number;
    remaining: number;
    complete: number;
    assigned: number;
    unassigned: number;
    assignmentUnknown: number;
    mapped: number;
    unmapped: number;
    scheduledMinutes: number;
  };
}

export interface OwnerDispatchProjectionRow {
  id: string;
  external_visit_id: string;
  external_property_id: string;
  jobber_property_web_uri: string | null;
  property_name: string | null;
  property_address: unknown;
  job_number: number | null;
  title: string | null;
  client_name: string;
  visit_status: string;
  job_status: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  is_complete: boolean;
  raw_payload: unknown;
}

export interface OwnerDispatchGeocodeRow {
  external_property_id: string;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string;
}

function calendarMonth(reference: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).format(reference);
}

export function normalizeOwnerDispatchMonth(
  value: string | null | undefined,
  reference: Date = new Date(),
): string {
  return value && OWNER_DISPATCH_MONTH_PATTERN.test(value)
    ? value
    : calendarMonth(reference);
}

export function ownerDispatchMonthUtcBounds(month: string): {
  startUtc: Date;
  endUtc: Date;
} {
  if (!OWNER_DISPATCH_MONTH_PATTERN.test(month)) {
    throw new Error("Choose a valid dispatch month.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return {
    startUtc: zonedDateTimeToUtc(`${month}-01`, 0, 0, 0),
    endUtc: zonedDateTimeToUtc(`${nextMonth}-01`, 0, 0, 0),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPropertyAddress(value: unknown): {
  address: string | null;
  city: string | null;
} {
  if (!value || typeof value !== "object") {
    return { address: null, city: null };
  }
  const candidate = value as Record<string, unknown>;
  const street = text(candidate.street1);
  const street2 = text(candidate.street2);
  const city = text(candidate.city);
  const province = text(candidate.province);
  const postalCode = text(candidate.postalCode);
  const address = [street, street2, city, province, postalCode]
    .filter(Boolean)
    .join(", ");
  return { address: address || null, city };
}

function scheduledMinutes(start: string, end: string | null): number {
  if (!end) return 0;
  const duration = Date.parse(end) - Date.parse(start);
  return Number.isFinite(duration) && duration > 0
    ? Math.round(duration / 60_000)
    : 0;
}

export function buildOwnerDispatchPayload(input: {
  month: string;
  connected: boolean;
  connectionStatus: string;
  accountName: string | null;
  lastSyncedAt: string | null;
  projections: OwnerDispatchProjectionRow[];
  geocodes: OwnerDispatchGeocodeRow[];
  homeAtlasAssignments?: Map<
    string,
    { id: string; technicianIdentityKey: string; technicianDisplayName: string }
  >;
  assignableUsers?: OwnerDispatchAssignableUser[];
  assignmentCapability?: OwnerDispatchAssignmentCapability;
  assignmentMessage?: string | null;
  generatedAt?: string;
}): OwnerDispatchPayload {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt);
  const geocodeByPropertyId = new Map(
    input.geocodes.map((row) => [row.external_property_id, row]),
  );
  const visits = input.projections.filter((row) => {
    const scheduledStartMs = Date.parse(row.scheduled_start);
    return !row.is_complete &&
      row.visit_status !== "REMOVED" &&
      Number.isFinite(scheduledStartMs) &&
      scheduledStartMs > generatedAtMs;
  }).map((row): OwnerDispatchVisit => {
    const assignment = readJobberTodayVisitAssignment(row.raw_payload);
    const homeAtlasAssignment = input.homeAtlasAssignments?.get(
      row.external_visit_id,
    );
    const scope = readJobberTodayVisitScope(row.raw_payload);
    const property = readPropertyAddress(row.property_address);
    const geocode = geocodeByPropertyId.get(row.external_property_id);
    const location =
      geocode?.geocode_status === "resolved" &&
      typeof geocode.latitude === "number" &&
      typeof geocode.longitude === "number"
        ? { latitude: geocode.latitude, longitude: geocode.longitude }
        : null;
    return {
      projectionId: row.id,
      externalVisitId: row.external_visit_id,
      externalPropertyId: row.external_property_id,
      clientName: row.client_name,
      serviceLabel: row.title?.trim() || "Scheduled Jobber service",
      jobNumber: row.job_number,
      visitStatus: row.visit_status,
      jobStatus: row.job_status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      isComplete: row.is_complete,
      assignedUsers: assignment.assignedUsers,
      homeAtlasAssignedTechnician: homeAtlasAssignment
        ? {
            id: homeAtlasAssignment.technicianIdentityKey,
            name: homeAtlasAssignment.technicianDisplayName,
          }
        : null,
      homeAtlasFieldAssignmentId: homeAtlasAssignment?.id ?? null,
      assignmentReadState: assignment.assignmentReadState,
      scopeItems: scope.scopeItems,
      address: geocode?.formatted_address ?? property.address,
      city: property.city,
      location,
      jobberPropertyWebUri: row.jobber_property_web_uri,
      homeAtlasVisitHref: `/hq/jobber#jobber-visit-${row.id}`,
    };
  });

  const crewTotals = new Map<string, OwnerDispatchCrewMember>();
  for (const visit of visits) {
    const minutes = scheduledMinutes(visit.scheduledStart, visit.scheduledEnd);
    const staffedUsers = visit.homeAtlasAssignedTechnician
      ? [visit.homeAtlasAssignedTechnician]
      : visit.assignedUsers;
    for (const user of staffedUsers) {
      const existing = crewTotals.get(user.id);
      crewTotals.set(user.id, {
        jobberUserId: user.id,
        displayName: existing?.displayName ?? user.name,
        visitCount: (existing?.visitCount ?? 0) + 1,
        scheduledMinutes: (existing?.scheduledMinutes ?? 0) + minutes,
      });
    }
  }

  const assigned = visits.filter(
    (visit) =>
      Boolean(visit.homeAtlasAssignedTechnician) ||
      (visit.assignmentReadState === "available" && visit.assignedUsers.length > 0),
  ).length;
  const unassigned = visits.filter(
    (visit) =>
      !visit.homeAtlasAssignedTechnician &&
      visit.assignmentReadState === "available" && visit.assignedUsers.length === 0,
  ).length;
  const assignmentUnknown = visits.filter(
    (visit) => visit.assignmentReadState !== "available",
  ).length;
  const complete = visits.filter((visit) => visit.isComplete).length;
  const mapped = visits.filter((visit) => visit.location !== null).length;

  return {
    month: input.month,
    timezone: COMPANY_BUSINESS_TIMEZONE,
    generatedAt,
    connected: input.connected,
    connectionStatus: input.connectionStatus,
    accountName: input.accountName,
    lastSyncedAt: input.lastSyncedAt,
    visits,
    crew: [...crewTotals.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "en-US"),
    ),
    assignableUsers: input.assignableUsers ?? [],
    assignmentCapability: input.assignmentCapability ?? "unavailable",
    assignmentMessage: input.assignmentMessage ?? null,
    summary: {
      total: visits.length,
      remaining: visits.length - complete,
      complete,
      assigned,
      unassigned,
      assignmentUnknown,
      mapped,
      unmapped: visits.length - mapped,
      scheduledMinutes: visits.reduce(
        (total, visit) =>
          total + scheduledMinutes(visit.scheduledStart, visit.scheduledEnd),
        0,
      ),
    },
  };
}
