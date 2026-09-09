import "server-only";

import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  getBusinessCalendarDayUtcBounds,
} from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { SQUEEGEEKING_TEAM_LEADS } from "@/lib/team/founders";
import {
  HOMEATLAS_TECHNICIAN_PREFIX,
  type TechnicianAccessGrantView,
} from "./field-access";
import { reconcilePendingLiveDispatchJobs } from "./live-dispatch-server";
import { loadTechnicianCapacitySnapshot } from "./technician-capacity-server";
import { resolveTechnicianFieldPassState } from "./technician-dispatch";
import {
  TECHNICIAN_PROFILE_ACTIVITY_DAYS,
  TYLER_GERMANY_TECHNICIAN_ID,
  isTechnicianProfileId,
  type TechnicianOperationalProfile,
  type TechnicianProfileLiveJob,
  type TechnicianProfileRecentCloseout,
} from "./technician-profile";
import { loadTechnicianReadinessSnapshot } from "./technician-readiness-server";

interface TechnicianRow {
  id: string;
  display_name: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

interface AccessGrantRow {
  id: string;
  jobber_user_id: string;
  display_name: string;
  status: "pending" | "active" | "revoked";
  invite_expires_at: string;
  session_expires_at: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface AssignmentRow {
  id: string;
  external_visit_id: string;
  assigned_at: string;
  source_kind: "jobber" | "live";
  sync_state: "pending_sync" | "verified";
  live_client_name: string | null;
  live_service_title: string | null;
  live_property_address: string | null;
  live_scheduled_start: string | null;
  live_sold_amount_cents: number | null;
  reconciled_at: string | null;
  jobber_visit_projections:
    | { scheduled_start: string | null }
    | Array<{ scheduled_start: string | null }>
    | null;
}

interface CloseoutRow {
  id: string;
  assignment_id: string;
  external_visit_id: string;
  visit_date: string;
  follow_up_needed: boolean;
  scope_read_state: string;
  scope_exception: string | null;
  created_at: string;
}

interface TimeEntryRow {
  started_at: string;
  ended_at: string | null;
}

interface NativeClockRow extends TimeEntryRow {
  assignment_id: string;
}

interface VisitEventRow {
  event_type: string;
  occurred_at: string;
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: { value: string; time: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) continue;
    if (!latest || time > latest.time) latest = { value, time };
  }
  return latest?.value ?? null;
}

function durationMinutes(entry: TimeEntryRow): number {
  if (!entry.ended_at) return 0;
  const start = new Date(entry.started_at).getTime();
  const end = new Date(entry.ended_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

function withinUtcWindow(value: string | null, start: Date, end: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function assignmentScheduledAt(row: AssignmentRow): string | null {
  if (row.live_scheduled_start) return row.live_scheduled_start;
  const projection = Array.isArray(row.jobber_visit_projections)
    ? row.jobber_visit_projections[0]
    : row.jobber_visit_projections;
  return projection?.scheduled_start ?? null;
}

function nativeClockState(row: NativeClockRow | undefined): TechnicianProfileLiveJob["clockState"] {
  if (!row) return "not_started";
  return row.ended_at ? "finished" : "running";
}

function roleTitleForTechnician(technicianId: string): string {
  const teamLeadSlug =
    technicianId === TYLER_GERMANY_TECHNICIAN_ID ? "tyler" : null;
  if (!teamLeadSlug) return "Technician";
  return (
    SQUEEGEEKING_TEAM_LEADS.find((member) => member.slug === teamLeadSlug)?.role ??
    "Technician"
  );
}

function toGrantView(row: AccessGrantRow): TechnicianAccessGrantView {
  return {
    id: row.id,
    jobberUserId: row.jobber_user_id,
    displayName: row.display_name,
    status: row.status,
    inviteExpiresAt: row.invite_expires_at,
    sessionExpiresAt: row.session_expires_at,
    claimedAt: row.claimed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function loadTechnicianOperationalProfile(
  technicianId: string,
  reference: Date = new Date(),
): Promise<TechnicianOperationalProfile | null> {
  if (!isTechnicianProfileId(technicianId)) {
    throw new Error("Choose a valid HomeAtlas technician.");
  }

  const reconciliation = await reconcilePendingLiveDispatchJobs(reference).catch(
    () => ({
      reconciled: 0,
      warnings: ["Live jobs could not be checked against Jobber yet."],
    }),
  );

  const supabase = createServiceRoleSupabaseClient();
  const technicianResult = await supabase
    .from("homeatlas_technicians")
    .select("id, display_name, status, created_at, updated_at")
    .eq("id", technicianId)
    .maybeSingle();

  if (technicianResult.error) {
    throw new Error("Technician identity could not be loaded safely.");
  }
  if (!technicianResult.data) return null;

  const technician = technicianResult.data as TechnicianRow;
  const identityKey = `${HOMEATLAS_TECHNICIAN_PREFIX}${technician.id}`;
  const since = new Date(
    reference.getTime() - TECHNICIAN_PROFILE_ACTIVITY_DAYS * 24 * 60 * 60 * 1_000,
  );
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);
  const today = formatBusinessCalendarDate(reference);
  const { startUtc: todayStart, endUtc: todayEnd } =
    getBusinessCalendarDayUtcBounds(reference, COMPANY_BUSINESS_TIMEZONE);

  const [readinessSettled, capacitySettled] = await Promise.allSettled([
    loadTechnicianReadinessSnapshot(reference),
    loadTechnicianCapacitySnapshot(reference),
  ]);

  const [accessResult, assignmentsResult, closeoutsResult, legacyTimeResult, eventsResult] =
    await Promise.all([
      supabase
        .from("technician_access_grants")
        .select(
          "id, jobber_user_id, display_name, status, invite_expires_at, session_expires_at, claimed_at, revoked_at, created_at",
        )
        .eq("jobber_user_id", identityKey)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("homeatlas_technician_visit_assignments")
        .select(
          "id, external_visit_id, assigned_at, source_kind, sync_state, live_client_name, live_service_title, live_property_address, live_scheduled_start, live_sold_amount_cents, reconciled_at, jobber_visit_projections(scheduled_start)",
        )
        .eq("technician_id", technician.id)
        .gte("assigned_at", sinceIso)
        .order("assigned_at", { ascending: false })
        .limit(5_000),
      supabase
        .from("homeatlas_technician_job_closeouts")
        .select(
          "id, assignment_id, external_visit_id, visit_date, follow_up_needed, scope_read_state, scope_exception, created_at",
        )
        .eq("technician_id", technician.id)
        .gte("visit_date", sinceDate)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5_000),
      supabase
        .from("technician_job_time_entries")
        .select("started_at, ended_at")
        .eq("started_by_jobber_user_id", identityKey)
        .gte("started_at", sinceIso)
        .order("started_at", { ascending: false })
        .limit(5_000),
      supabase
        .from("technician_visit_events")
        .select("event_type, occurred_at")
        .eq("jobber_user_id", identityKey)
        .gte("occurred_at", sinceIso)
        .order("occurred_at", { ascending: false })
        .limit(5_000),
    ]);

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const assignmentIds = assignments.map((row) => row.id);
  const nativeClockResult = assignmentIds.length
    ? await supabase
        .from("homeatlas_technician_job_clocks")
        .select("assignment_id, started_at, ended_at")
        .in("assignment_id", assignmentIds)
        .gte("started_at", sinceIso)
        .order("started_at", { ascending: false })
        .limit(5_000)
    : { data: [], error: null };

  const warnings: string[] = [...reconciliation.warnings];
  if (readinessSettled.status === "rejected") {
    warnings.push("Readiness evidence could not be loaded for this profile.");
  }
  if (capacitySettled.status === "rejected") {
    warnings.push("Capacity evidence could not be loaded for this profile.");
  }
  for (const [label, result] of [
    ["Field access", accessResult],
    ["Assignments", assignmentsResult],
    ["Closeouts", closeoutsResult],
    ["Legacy job clock", legacyTimeResult],
    ["Native job clock", nativeClockResult],
    ["Visit events", eventsResult],
  ] as const) {
    if (result.error) warnings.push(`${label} data is temporarily unavailable.`);
  }

  const readinessSnapshot =
    readinessSettled.status === "fulfilled" ? readinessSettled.value : null;
  const capacitySnapshot =
    capacitySettled.status === "fulfilled" ? capacitySettled.value : null;
  if (readinessSnapshot) warnings.push(...readinessSnapshot.warnings);
  if (capacitySnapshot) warnings.push(...capacitySnapshot.warnings);

  const readiness =
    readinessSnapshot?.technicians.find(
      (candidate) => candidate.jobberUserId === identityKey,
    ) ?? null;
  const capacity =
    capacitySnapshot?.technicians.find(
      (candidate) => candidate.jobberUserId === identityKey,
    ) ?? null;
  const trials =
    readinessSnapshot?.trials.filter(
      (trial) => trial.jobberUserId === identityKey,
    ) ?? [];

  const accessRows = (accessResult.data ?? []) as AccessGrantRow[];
  const currentAccessRow =
    accessRows.find((row) => row.status === "active" || row.status === "pending") ??
    accessRows[0] ??
    null;
  const grantView = currentAccessRow ? toGrantView(currentAccessRow) : null;
  const accessState = resolveTechnicianFieldPassState(grantView, reference);

  const closeouts = (closeoutsResult.data ?? []) as CloseoutRow[];
  const legacyTimeEntries = (legacyTimeResult.data ?? []) as TimeEntryRow[];
  const nativeClocks = (nativeClockResult.data ?? []) as NativeClockRow[];
  const visitEvents = (eventsResult.data ?? []) as VisitEventRow[];
  const nativeClockByAssignment = new Map(
    nativeClocks.map((row) => [row.assignment_id, row]),
  );
  const closeoutByAssignment = new Map(
    closeouts.map((row) => [row.assignment_id, row]),
  );

  const allClockedMinutes =
    nativeClocks.reduce((total, entry) => total + durationMinutes(entry), 0) +
    legacyTimeEntries.reduce((total, entry) => total + durationMinutes(entry), 0);
  const todayClockedMinutes =
    nativeClocks
      .filter((entry) => withinUtcWindow(entry.started_at, todayStart, todayEnd))
      .reduce((total, entry) => total + durationMinutes(entry), 0) +
    legacyTimeEntries
      .filter((entry) => withinUtcWindow(entry.started_at, todayStart, todayEnd))
      .reduce((total, entry) => total + durationMinutes(entry), 0);

  const todayAssignments = assignments.filter((assignment) =>
    withinUtcWindow(assignmentScheduledAt(assignment), todayStart, todayEnd),
  );
  const liveAssignments = assignments.filter(
    (assignment) => assignment.source_kind === "live",
  );
  const liveJobs: TechnicianProfileLiveJob[] = liveAssignments
    .filter(
      (assignment) =>
        assignment.live_client_name &&
        assignment.live_service_title &&
        assignment.live_scheduled_start,
    )
    .slice(0, 20)
    .map((assignment) => {
      const clock = nativeClockByAssignment.get(assignment.id);
      return {
        assignmentId: assignment.id,
        externalVisitId: assignment.external_visit_id,
        clientName: assignment.live_client_name!,
        serviceTitle: assignment.live_service_title!,
        propertyAddress: assignment.live_property_address,
        scheduledStart: assignment.live_scheduled_start!,
        soldAmountCents: assignment.live_sold_amount_cents,
        syncState: assignment.sync_state,
        reconciledAt: assignment.reconciled_at,
        clockState: nativeClockState(clock),
        clockStartedAt: clock?.started_at ?? null,
        clockEndedAt: clock?.ended_at ?? null,
        closeoutSaved: closeoutByAssignment.has(assignment.id),
      };
    });

  const recentCloseouts: TechnicianProfileRecentCloseout[] = closeouts
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      externalVisitId: row.external_visit_id,
      visitDate: row.visit_date,
      followUpNeeded: row.follow_up_needed,
      scopeReadState: row.scope_read_state,
      scopeException: row.scope_exception,
      createdAt: row.created_at,
    }));

  const generatedAt = new Date().toISOString();
  const jobberLastSyncedAt =
    readinessSnapshot?.lastJobberSyncAt ??
    capacitySnapshot?.lastJobberSyncAt ??
    null;

  return {
    generatedAt,
    technician: {
      id: technician.id,
      identityKey,
      displayName: technician.display_name,
      roleTitle: roleTitleForTechnician(technician.id),
      status: technician.status,
      createdAt: technician.created_at,
      updatedAt: technician.updated_at,
    },
    access: {
      grantId: currentAccessRow?.id ?? null,
      state: accessState,
      claimedAt: currentAccessRow?.claimed_at ?? null,
      sessionExpiresAt: currentAccessRow?.session_expires_at ?? null,
      createdAt: currentAccessRow?.created_at ?? null,
    },
    readiness,
    capacity,
    trials,
    activity: {
      windowDays: TECHNICIAN_PROFILE_ACTIVITY_DAYS,
      assignments: assignments.length,
      closeouts: closeouts.length,
      clockedMinutes: allClockedMinutes,
      activeClocks:
        nativeClocks.filter((entry) => !entry.ended_at).length +
        legacyTimeEntries.filter((entry) => !entry.ended_at).length,
      followUpCloseouts: closeouts.filter((row) => row.follow_up_needed).length,
      scopeExceptionCloseouts: closeouts.filter(
        (row) => Boolean(row.scope_exception?.trim()),
      ).length,
      visitEvents: visitEvents.length,
      lastActivityAt: latestTimestamp([
        assignments[0]?.assigned_at,
        closeouts[0]?.created_at,
        nativeClocks[0]?.ended_at ?? nativeClocks[0]?.started_at,
        legacyTimeEntries[0]?.ended_at ?? legacyTimeEntries[0]?.started_at,
        visitEvents[0]?.occurred_at,
      ]),
      todayAssignments: todayAssignments.length,
      todayCloseouts: closeouts.filter((row) => row.visit_date === today).length,
      todayClockedMinutes,
      pendingSyncJobs: liveAssignments.filter(
        (assignment) => assignment.sync_state === "pending_sync",
      ).length,
      liveSoldAmountCentsToday: todayAssignments
        .filter((assignment) => assignment.source_kind === "live")
        .reduce(
          (sum, assignment) => sum + (assignment.live_sold_amount_cents ?? 0),
          0,
        ),
    },
    freshness: {
      homeAtlasLiveAt: generatedAt,
      jobberLastSyncedAt,
      jobberDataFresh: Boolean(
        readinessSnapshot?.jobberDataFresh ?? capacitySnapshot?.jobberDataFresh,
      ),
    },
    liveJobs,
    recentCloseouts,
    warnings: [...new Set(warnings)],
  };
}
