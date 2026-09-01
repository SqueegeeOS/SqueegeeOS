import "server-only";

import { createHash } from "node:crypto";
import { getFreshJobberAccessToken } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  assignJobberVisitUsers,
  fetchJobberAssignableUsers,
  fetchJobberVisitAssignment,
  JobberAssignmentError,
  type JobberAssignableUser,
} from "@/lib/care-operations/jobber-visit-assignment";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AssignmentProjectionRow {
  id: string;
  external_visit_id: string;
  client_name: string;
  title: string | null;
  scheduled_start: string | null;
  is_complete: boolean;
  visit_status: string;
  raw_payload: unknown;
}

export type OwnerDispatchAssignmentCode =
  | "invalid_request"
  | "not_found"
  | "not_future"
  | "conflict"
  | "permission_required"
  | "provider_rejected"
  | "provider_unavailable"
  | "verification_failed";

export class OwnerDispatchAssignmentError extends Error {
  constructor(
    message: string,
    readonly code: OwnerDispatchAssignmentCode,
  ) {
    super(message);
    this.name = "OwnerDispatchAssignmentError";
  }
}

function sortedIds(users: Array<{ id: string }>): string[] {
  return users.map((user) => user.id).sort();
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function updatedRawPayload(
  value: unknown,
  assignedUsers: Array<{ id: string; name: string }>,
): Record<string, unknown> {
  const base = value && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {};
  return {
    ...base,
    assignedUsers,
    assignmentReadState: "available",
  };
}

export async function loadOwnerDispatchAssignableUsers(): Promise<
  JobberAssignableUser[]
> {
  const accessToken = await getFreshJobberAccessToken();
  return fetchJobberAssignableUsers(accessToken);
}

export async function assignOwnerDispatchVisit(input: {
  projectionId: string;
  jobberUserId: string;
  expectedAssignedUserIds: string[];
  clientRequestId: string;
  actor?: string;
  now?: Date;
}) {
  if (
    !UUID_PATTERN.test(input.projectionId) ||
    !UUID_PATTERN.test(input.clientRequestId) ||
    !input.jobberUserId.trim() ||
    input.jobberUserId.length > 240 ||
    input.expectedAssignedUserIds.length > 25 ||
    input.expectedAssignedUserIds.some((id) => !id.trim() || id.length > 240)
  ) {
    throw new OwnerDispatchAssignmentError(
      "Choose a valid future visit and technician.",
      "invalid_request",
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const priorEvent = await supabase
    .from("owner_dispatch_assignment_events")
    .select("external_visit_id, assigned_user_ids, assigned_user_names, provider_confirmed_at")
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();
  if (priorEvent.error) throw new Error(priorEvent.error.message);
  if (priorEvent.data) {
    const priorAssignment = priorEvent.data;
    return {
      status: "assigned" as const,
      visitId: priorAssignment.external_visit_id as string,
      assignedUsers: (priorAssignment.assigned_user_ids as string[]).map(
        (id, index) => ({
          id,
          name: (priorAssignment.assigned_user_names as string[])[index] ?? id,
        }),
      ),
      confirmedAt: priorAssignment.provider_confirmed_at as string,
      replayed: true,
    };
  }

  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select(
      "id, external_visit_id, client_name, title, scheduled_start, is_complete, visit_status, raw_payload",
    )
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("id", input.projectionId)
    .maybeSingle();
  if (projectionResult.error) throw new Error(projectionResult.error.message);
  const projection = projectionResult.data as AssignmentProjectionRow | null;
  if (!projection) {
    throw new OwnerDispatchAssignmentError(
      "That Jobber visit is no longer in HomeAtlas.",
      "not_found",
    );
  }
  const now = input.now ?? new Date();
  if (
    projection.is_complete ||
    projection.visit_status === "REMOVED" ||
    !projection.scheduled_start ||
    Date.parse(projection.scheduled_start) <= now.getTime()
  ) {
    throw new OwnerDispatchAssignmentError(
      "Only an active future Jobber visit can be assigned here.",
      "not_future",
    );
  }

  const accessToken = await getFreshJobberAccessToken();
  let roster: JobberAssignableUser[];
  try {
    roster = await fetchJobberAssignableUsers(accessToken);
  } catch (error) {
    if (error instanceof JobberAssignmentError) {
      throw new OwnerDispatchAssignmentError(error.message, error.code);
    }
    throw error;
  }
  const technician = roster.find((user) => user.id === input.jobberUserId);
  if (!technician) {
    throw new OwnerDispatchAssignmentError(
      "That technician is not currently available for scheduling in Jobber.",
      "invalid_request",
    );
  }

  let liveBefore;
  try {
    liveBefore = await fetchJobberVisitAssignment(
      accessToken,
      projection.external_visit_id,
    );
  } catch (error) {
    if (error instanceof JobberAssignmentError) {
      throw new OwnerDispatchAssignmentError(error.message, error.code);
    }
    throw error;
  }
  const liveIds = sortedIds(liveBefore.assignedUsers);
  const expectedIds = [...new Set(input.expectedAssignedUserIds)].sort();
  const desiredIds = [technician.id];
  if (!sameIds(liveIds, expectedIds) && !sameIds(liveIds, desiredIds)) {
    throw new OwnerDispatchAssignmentError(
      "Jobber changed this visit after the board loaded. Refresh Dispatch before replacing its crew.",
      "conflict",
    );
  }

  let confirmed = liveBefore;
  if (!sameIds(liveIds, desiredIds)) {
    try {
      confirmed = await assignJobberVisitUsers({
        accessToken,
        visitId: projection.external_visit_id,
        assignedUserIds: desiredIds,
      });
    } catch (error) {
      if (error instanceof JobberAssignmentError) {
        throw new OwnerDispatchAssignmentError(error.message, error.code);
      }
      throw error;
    }
  }
  const confirmedIds = sortedIds(confirmed.assignedUsers);
  if (!sameIds(confirmedIds, desiredIds)) {
    throw new OwnerDispatchAssignmentError(
      "Jobber did not confirm the requested technician, so HomeAtlas left the board unchanged.",
      "verification_failed",
    );
  }

  const confirmedAt = new Date().toISOString();
  const rawPayload = updatedRawPayload(
    projection.raw_payload,
    confirmed.assignedUsers,
  );
  const projectionUpdate = await supabase
    .from("jobber_visit_projections")
    .update({
      raw_payload: rawPayload,
      source_payload_hash: createHash("sha256")
        .update(JSON.stringify(rawPayload))
        .digest("hex"),
      source_observed_at: confirmedAt,
      last_seen_at: confirmedAt,
    })
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("id", projection.id)
    .eq("external_visit_id", projection.external_visit_id)
    .select("id")
    .maybeSingle();
  if (projectionUpdate.error || !projectionUpdate.data) {
    throw new OwnerDispatchAssignmentError(
      "Jobber accepted the assignment, but HomeAtlas could not refresh its mirror. Sync Jobber before assigning another visit.",
      "verification_failed",
    );
  }

  const event = await supabase.from("owner_dispatch_assignment_events").insert({
    client_request_id: input.clientRequestId,
    connection_id: JOBBER_CONNECTION_ID,
    projection_id: projection.id,
    external_visit_id: projection.external_visit_id,
    previous_assigned_user_ids: liveIds,
    assigned_user_ids: confirmed.assignedUsers.map((user) => user.id),
    assigned_user_names: confirmed.assignedUsers.map((user) => user.name),
    actor: input.actor?.trim() || "HomeAtlas HQ",
    provider_confirmed_at: confirmedAt,
  });
  if (event.error) {
    console.error("[owner-dispatch] assignment audit insert failed", {
      projectionId: projection.id,
      providerConfirmed: true,
    });
  }

  console.info("[owner-dispatch] Jobber assignment confirmed", {
    projectionId: projection.id,
    externalVisitId: projection.external_visit_id,
    assignedUserIds: confirmed.assignedUsers.map((user) => user.id),
  });
  return {
    status: "assigned" as const,
    visitId: projection.external_visit_id,
    assignedUsers: confirmed.assignedUsers,
    confirmedAt,
    replayed: false,
  };
}
