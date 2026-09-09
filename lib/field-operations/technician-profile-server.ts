import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { SQUEEGEEKING_TEAM_LEADS } from "@/lib/team/founders";
import {
  HOMEATLAS_TECHNICIAN_PREFIX,
  type TechnicianAccessGrantView,
} from "./field-access";
import { loadTechnicianCapacitySnapshot } from "./technician-capacity-server";
import { resolveTechnicianFieldPassState } from "./technician-dispatch";
import {
  TECHNICIAN_PROFILE_ACTIVITY_DAYS,
  TYLER_GERMANY_TECHNICIAN_ID,
  isTechnicianProfileId,
  type TechnicianOperationalProfile,
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
  assigned_at: string;
}

interface CloseoutRow {
  id: string;
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

  const [readinessSettled, capacitySettled] = await Promise.allSettled([
    loadTechnicianReadinessSnapshot(reference),
    loadTechnicianCapacitySnapshot(reference),
  ]);

  const [accessResult, assignmentsResult, closeoutsResult, timeResult, eventsResult] =
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
        .select("assigned_at")
        .eq("technician_id", technician.id)
        .gte("assigned_at", sinceIso)
        .order("assigned_at", { ascending: false })
        .limit(5_000),
      supabase
        .from("homeatlas_technician_job_closeouts")
        .select(
          "id, external_visit_id, visit_date, follow_up_needed, scope_read_state, scope_exception, created_at",
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

  const warnings: string[] = [];
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
    ["Job clock", timeResult],
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

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const closeouts = (closeoutsResult.data ?? []) as CloseoutRow[];
  const timeEntries = (timeResult.data ?? []) as TimeEntryRow[];
  const visitEvents = (eventsResult.data ?? []) as VisitEventRow[];
  const clockedMinutes = timeEntries.reduce((total, entry) => {
    if (!entry.ended_at) return total;
    const start = new Date(entry.started_at).getTime();
    const end = new Date(entry.ended_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return total;
    return total + Math.round((end - start) / 60_000);
  }, 0);

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

  return {
    generatedAt: new Date().toISOString(),
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
      clockedMinutes,
      activeClocks: timeEntries.filter((entry) => !entry.ended_at).length,
      followUpCloseouts: closeouts.filter((row) => row.follow_up_needed).length,
      scopeExceptionCloseouts: closeouts.filter(
        (row) => Boolean(row.scope_exception?.trim()),
      ).length,
      visitEvents: visitEvents.length,
      lastActivityAt: latestTimestamp([
        assignments[0]?.assigned_at,
        closeouts[0]?.created_at,
        timeEntries[0]?.ended_at ?? timeEntries[0]?.started_at,
        visitEvents[0]?.occurred_at,
      ]),
    },
    recentCloseouts,
    warnings: [...new Set(warnings)],
  };
}
