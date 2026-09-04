import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { readJobberTodayVisitAssignment } from "@/lib/care-operations/jobber-today-types";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  FIELD_INVITE_TTL_MS,
  FIELD_SESSION_COOKIE_NAME,
  FIELD_SESSION_TTL_MS,
} from "./field-access-config";

export {
  FIELD_INVITE_TTL_MS,
  FIELD_SESSION_COOKIE_NAME,
  FIELD_SESSION_TTL_MS,
} from "./field-access-config";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOMEATLAS_TECHNICIAN_PREFIX = "homeatlas:";

function recentRosterWindow(): { from: string; to: string } {
  const now = Date.now();
  return {
    from: new Date(now - 90 * 24 * 60 * 60 * 1_000).toISOString(),
    to: new Date(now + 180 * 24 * 60 * 60 * 1_000).toISOString(),
  };
}

export interface AdminFieldActor {
  kind: "admin";
  displayName: "HomeAtlas HQ";
  grantId: null;
  jobberUserId: null;
}

export interface TechnicianFieldActor {
  kind: "technician";
  role: "technician";
  displayName: string;
  grantId: string;
  jobberUserId: string;
  sessionExpiresAt: string;
}

export type FieldActor = AdminFieldActor | TechnicianFieldActor;

export interface TechnicianAccessGrantView {
  id: string;
  jobberUserId: string;
  displayName: string;
  status: "pending" | "active" | "revoked";
  inviteExpiresAt: string;
  sessionExpiresAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface TechnicianRosterMember {
  jobberUserId: string;
  displayName: string;
  source?: "jobber" | "homeatlas";
  observedStopCount: number;
  latestObservedAt: string | null;
  currentGrant: TechnicianAccessGrantView | null;
}

interface TechnicianAccessGrantRow {
  id: string;
  jobber_user_id: string;
  display_name: string;
  status: "pending" | "active" | "revoked";
  access_role: "technician";
  invite_expires_at: string;
  session_expires_at: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface JobberAssignmentProjectionRow {
  raw_payload: unknown;
  source_observed_at: string | null;
}

interface HomeAtlasTechnicianRow {
  id: string;
  display_name: string;
  status: "active" | "inactive";
}

function homeAtlasTechnicianId(identityKey: string): string | null {
  if (!identityKey.startsWith(HOMEATLAS_TECHNICIAN_PREFIX)) return null;
  const id = identityKey.slice(HOMEATLAS_TECHNICIAN_PREFIX.length);
  return UUID_PATTERN.test(id) ? id : null;
}

interface ClaimRpcRow {
  grant_id: string;
  jobber_user_id: string;
  display_name: string;
  session_expires_at: string;
}

function normalizedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function isFieldAccessToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function hashFieldAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueOpaqueFieldToken(): string {
  return randomBytes(32).toString("base64url");
}

export function fieldSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== FIELD_SESSION_COOKIE_NAME) continue;
    try {
      const token = decodeURIComponent(pair.slice(separator + 1).trim());
      return isFieldAccessToken(token) ? token : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toGrantView(row: TechnicianAccessGrantRow): TechnicianAccessGrantView {
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

export async function authorizeFieldRequest(
  headers: Headers,
): Promise<FieldActor | null> {
  if (authorizeAdminRequest(headers)) {
    return {
      kind: "admin",
      displayName: "HomeAtlas HQ",
      grantId: null,
      jobberUserId: null,
    };
  }

  const sessionToken = fieldSessionTokenFromHeaders(headers);
  if (!sessionToken) return null;

  try {
    const supabase = createServiceRoleSupabaseClient();
    const result = await supabase
      .from("technician_access_grants")
      .select(
        "id, jobber_user_id, display_name, status, access_role, session_expires_at",
      )
      .eq("session_token_hash", hashFieldAccessToken(sessionToken))
      .eq("status", "active")
      .eq("access_role", "technician")
      .gt("session_expires_at", new Date().toISOString())
      .maybeSingle();

    if (result.error || !result.data) return null;
    const row = result.data as Pick<
      TechnicianAccessGrantRow,
      "id" | "jobber_user_id" | "display_name" | "status" | "access_role" | "session_expires_at"
    >;
    if (!row.session_expires_at) return null;
    return {
      kind: "technician",
      role: "technician",
      grantId: row.id,
      jobberUserId: row.jobber_user_id,
      displayName: row.display_name,
      sessionExpiresAt: row.session_expires_at,
    };
  } catch {
    return null;
  }
}

export async function claimTechnicianFieldPass(inviteToken: string): Promise<{
  sessionToken: string;
  actor: TechnicianFieldActor;
}> {
  if (!isFieldAccessToken(inviteToken)) {
    throw new Error("This Technician Access link is invalid or expired.");
  }

  const sessionToken = issueOpaqueFieldToken();
  const sessionExpiresAt = new Date(Date.now() + FIELD_SESSION_TTL_MS);
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("claim_technician_access_grant", {
      p_invite_token_hash: hashFieldAccessToken(inviteToken),
      p_session_token_hash: hashFieldAccessToken(sessionToken),
      p_session_expires_at: sessionExpiresAt.toISOString(),
    })
    .single();

  if (result.error || !result.data) {
    throw new Error("This Technician Access link is invalid, expired, or already used.");
  }
  const row = result.data as ClaimRpcRow;
  return {
    sessionToken,
    actor: {
      kind: "technician",
      role: "technician",
      grantId: row.grant_id,
      jobberUserId: row.jobber_user_id,
      displayName: row.display_name,
      sessionExpiresAt: row.session_expires_at,
    },
  };
}

export async function issueTechnicianFieldPass(input: {
  jobberUserId: string;
  displayName: string;
  issuedBy?: string;
}): Promise<{
  grantId: string;
  inviteToken: string;
  inviteExpiresAt: string;
}> {
  const jobberUserId = normalizedText(input.jobberUserId, 255);
  const displayName = normalizedText(input.displayName, 80);
  const issuedBy = normalizedText(input.issuedBy ?? "HomeAtlas HQ", 80);
  if (!jobberUserId || !displayName || !issuedBy) {
    throw new Error("Choose a valid mirrored Jobber crew member.");
  }

  const inviteToken = issueOpaqueFieldToken();
  const inviteExpiresAt = new Date(Date.now() + FIELD_INVITE_TTL_MS);
  const supabase = createServiceRoleSupabaseClient();
  const rosterWindow = recentRosterWindow();
  const nativeTechnicianId = homeAtlasTechnicianId(jobberUserId);

  if (nativeTechnicianId) {
    const nativeTechnician = await supabase
      .from("homeatlas_technicians")
      .select("id, display_name, status")
      .eq("id", nativeTechnicianId)
      .eq("status", "active")
      .maybeSingle();
    if (
      nativeTechnician.error ||
      !nativeTechnician.data ||
      nativeTechnician.data.display_name !== displayName
    ) {
      throw new Error("Choose an active HomeAtlas technician.");
    }
  }

  // A pass can only be issued for a Jobber user actually observed in the
  // read-only visit projection. HQ cannot invent a privileged crew identity.
  if (!nativeTechnicianId) {
    const observed = await supabase
      .from("jobber_visit_projections")
      .select("raw_payload")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .gte("scheduled_start", rosterWindow.from)
      .lte("scheduled_start", rosterWindow.to)
      .order("source_observed_at", { ascending: false })
      .limit(2_000);
    if (observed.error) throw new Error("Could not verify the Jobber crew roster.");
    const mirrored = (observed.data ?? []).some((candidate) =>
      readJobberTodayVisitAssignment(
        (candidate as { raw_payload: unknown }).raw_payload,
      ).assignedUsers.some(
        (user) => user.id === jobberUserId && user.name === displayName,
      ),
    );
    if (!mirrored) {
      throw new Error("Refresh Jobber before issuing access for this crew member.");
    }
  }

  const result = await supabase
    .rpc("issue_technician_access_grant", {
      p_jobber_user_id: jobberUserId,
      p_display_name: displayName,
      p_invite_token_hash: hashFieldAccessToken(inviteToken),
      p_invite_expires_at: inviteExpiresAt.toISOString(),
      p_issued_by: issuedBy,
    })
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not create Technician Access.");
  }
  const row = result.data as {
    grant_id: string;
    invite_expires_at: string;
  };
  return {
    grantId: row.grant_id,
    inviteToken,
    inviteExpiresAt: row.invite_expires_at,
  };
}

export async function revokeTechnicianFieldPass(
  grantId: string,
  revokedBy = "HomeAtlas HQ",
): Promise<{ grantId: string; revokedAt: string }> {
  if (!UUID_PATTERN.test(grantId) || !normalizedText(revokedBy, 80)) {
    throw new Error("Choose valid Technician Access to remove.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("revoke_technician_access_grant", {
      p_grant_id: grantId,
      p_revoked_by: revokedBy.trim(),
    })
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not remove Technician Access.");
  }
  const row = result.data as { grant_id: string; revoked_at: string };
  return { grantId: row.grant_id, revokedAt: row.revoked_at };
}

export async function listTechnicianAccessRoster(): Promise<{
  crew: TechnicianRosterMember[];
  grants: TechnicianAccessGrantView[];
}> {
  const supabase = createServiceRoleSupabaseClient();
  const rosterWindow = recentRosterWindow();
  const [projectionResult, grantResult, nativeTechnicianResult] = await Promise.all([
    supabase
      .from("jobber_visit_projections")
      .select("raw_payload, source_observed_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .gte("scheduled_start", rosterWindow.from)
      .lte("scheduled_start", rosterWindow.to)
      .order("source_observed_at", { ascending: false })
      .limit(2_000),
    supabase
      .from("technician_access_grants")
      .select(
        "id, jobber_user_id, display_name, status, access_role, invite_expires_at, session_expires_at, claimed_at, revoked_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("homeatlas_technicians")
      .select("id, display_name, status")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
  ]);
  if (projectionResult.error) {
    throw new Error("Could not read the mirrored Jobber crew roster.");
  }
  if (grantResult.error) {
    throw new Error(
      "Technician Access storage is not ready. Apply the latest migration.",
    );
  }
  if (nativeTechnicianResult.error) {
    throw new Error(
      "HomeAtlas technician roster is not ready. Apply the latest migration.",
    );
  }

  const grants = ((grantResult.data ?? []) as TechnicianAccessGrantRow[]).map(
    toGrantView,
  );
  const currentGrantByUser = new Map<string, TechnicianAccessGrantView>();
  for (const grant of grants) {
    if (
      !currentGrantByUser.has(grant.jobberUserId) &&
      (grant.status === "pending" || grant.status === "active")
    ) {
      currentGrantByUser.set(grant.jobberUserId, grant);
    }
  }

  const observedCrew = new Map<
    string,
    Omit<TechnicianRosterMember, "currentGrant">
  >();
  for (const projection of (projectionResult.data ?? []) as JobberAssignmentProjectionRow[]) {
    const assignment = readJobberTodayVisitAssignment(projection.raw_payload);
    if (assignment.assignmentReadState !== "available") continue;
    for (const user of assignment.assignedUsers) {
      const existing = observedCrew.get(user.id);
      observedCrew.set(user.id, {
        jobberUserId: user.id,
        displayName: existing?.displayName ?? user.name,
        source: "jobber",
        observedStopCount: (existing?.observedStopCount ?? 0) + 1,
        latestObservedAt:
          existing?.latestObservedAt ?? projection.source_observed_at,
      });
    }
  }

  for (const technician of (nativeTechnicianResult.data ?? []) as HomeAtlasTechnicianRow[]) {
    const identityKey = `${HOMEATLAS_TECHNICIAN_PREFIX}${technician.id}`;
    observedCrew.set(identityKey, {
      jobberUserId: identityKey,
      displayName: technician.display_name,
      source: "homeatlas",
      observedStopCount: observedCrew.get(identityKey)?.observedStopCount ?? 0,
      latestObservedAt: null,
    });
  }

  // A removed or inactive Jobber user must never disappear while their pass is
  // still live; HQ needs a visible revocation control even with zero recent stops.
  for (const [jobberUserId, currentGrant] of currentGrantByUser) {
    if (observedCrew.has(jobberUserId)) continue;
    observedCrew.set(jobberUserId, {
      jobberUserId,
      displayName: currentGrant.displayName,
      source: jobberUserId.startsWith(HOMEATLAS_TECHNICIAN_PREFIX)
        ? "homeatlas"
        : "jobber",
      observedStopCount: 0,
      latestObservedAt: null,
    });
  }

  const crew = [...observedCrew.values()]
    .map((member) => ({
      ...member,
      currentGrant: currentGrantByUser.get(member.jobberUserId) ?? null,
    }))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "en-US"),
    );
  return { crew, grants };
}
