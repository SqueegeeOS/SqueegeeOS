import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  SALES_INVITE_TTL_MS,
  SALES_SESSION_COOKIE_NAME,
  SALES_SESSION_TTL_MS,
} from "./sales-access-config";

export {
  SALES_INVITE_TTL_MS,
  SALES_SESSION_COOKIE_NAME,
  SALES_SESSION_TTL_MS,
} from "./sales-access-config";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AdminSalesActor {
  kind: "admin";
  displayName: "HomeAtlas HQ";
  grantId: null;
  repId: null;
  repSlug: null;
  sessionExpiresAt: null;
}

export interface SalesRepActor {
  kind: "sales_rep";
  displayName: string;
  grantId: string;
  repId: string;
  repSlug: string;
  sessionExpiresAt: string;
}

export type SalesActor = AdminSalesActor | SalesRepActor;

export interface SalesRepAccessGrantView {
  id: string;
  repId: string;
  status: "pending" | "active" | "revoked";
  inviteExpiresAt: string;
  sessionExpiresAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface SalesRepAccessRosterMember {
  repId: string;
  repSlug: string;
  displayName: string;
  roleTitle: string;
  currentGrant: SalesRepAccessGrantView | null;
}

interface SalesRepRow {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  status: "active" | "inactive";
}

interface SalesRepAccessGrantRow {
  id: string;
  rep_id: string;
  status: "pending" | "active" | "revoked";
  invite_expires_at: string;
  session_token_hash?: string | null;
  session_expires_at: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface ClaimRpcRow {
  grant_id: string;
  rep_id: string;
  rep_slug: string;
  display_name: string;
  session_expires_at: string;
}

function normalizedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizedRepSlug(value: unknown): string | null {
  const normalized = normalizedText(value, 80)?.toLowerCase() ?? null;
  return normalized && REP_SLUG_PATTERN.test(normalized) ? normalized : null;
}

export function isSalesAccessToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function hashSalesAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueOpaqueSalesToken(): string {
  return randomBytes(32).toString("base64url");
}

export function salesSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== SALES_SESSION_COOKIE_NAME) continue;
    try {
      const token = decodeURIComponent(pair.slice(separator + 1).trim());
      return isSalesAccessToken(token) ? token : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toGrantView(row: SalesRepAccessGrantRow): SalesRepAccessGrantView {
  return {
    id: row.id,
    repId: row.rep_id,
    status: row.status,
    inviteExpiresAt: row.invite_expires_at,
    sessionExpiresAt: row.session_expires_at,
    claimedAt: row.claimed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function authorizeSalesRequest(
  headers: Headers,
): Promise<SalesActor | null> {
  if (authorizeAdminRequest(headers)) {
    return {
      kind: "admin",
      displayName: "HomeAtlas HQ",
      grantId: null,
      repId: null,
      repSlug: null,
      sessionExpiresAt: null,
    };
  }

  const sessionToken = salesSessionTokenFromHeaders(headers);
  if (!sessionToken) return null;

  try {
    const supabase = createServiceRoleSupabaseClient();
    const grantResult = await supabase
      .from("sales_rep_access_grants")
      .select("id, rep_id, status, session_expires_at")
      .eq("session_token_hash", hashSalesAccessToken(sessionToken))
      .eq("status", "active")
      .gt("session_expires_at", new Date().toISOString())
      .maybeSingle();
    if (grantResult.error || !grantResult.data) return null;

    const grant = grantResult.data as Pick<
      SalesRepAccessGrantRow,
      "id" | "rep_id" | "status" | "session_expires_at"
    >;
    if (!grant.session_expires_at) return null;

    const repResult = await supabase
      .from("sales_reps")
      .select("id, slug, display_name, role_title, status")
      .eq("id", grant.rep_id)
      .eq("status", "active")
      .maybeSingle();
    if (repResult.error || !repResult.data) return null;
    const rep = repResult.data as SalesRepRow;

    return {
      kind: "sales_rep",
      grantId: grant.id,
      repId: rep.id,
      repSlug: rep.slug,
      displayName: rep.display_name,
      sessionExpiresAt: grant.session_expires_at,
    };
  } catch {
    return null;
  }
}

export function canSalesActorAccessRep(
  actor: SalesActor,
  repSlug: string,
): boolean {
  return (
    actor.kind === "admin" ||
    actor.repSlug === repSlug.trim().toLowerCase()
  );
}

export async function authorizeSalesRepRequest(
  headers: Headers,
  repSlug: string,
): Promise<SalesActor | null> {
  const actor = await authorizeSalesRequest(headers);
  return actor && canSalesActorAccessRep(actor, repSlug) ? actor : null;
}

export async function salesActorOwnsPresentation(
  actor: SalesActor,
  presentationId: string,
): Promise<boolean> {
  if (actor.kind === "admin") return true;
  if (!UUID_PATTERN.test(presentationId)) return false;

  try {
    const supabase = createServiceRoleSupabaseClient();
    const result = await supabase
      .from("presentations")
      .select("id")
      .eq("id", presentationId)
      .eq("sales_rep_id", actor.repId)
      .maybeSingle();
    return !result.error && Boolean(result.data);
  } catch {
    return false;
  }
}

export async function authorizeSalesPresentationRequest(
  headers: Headers,
  presentationId: string,
): Promise<SalesActor | null> {
  const actor = await authorizeSalesRequest(headers);
  return actor && (await salesActorOwnsPresentation(actor, presentationId))
    ? actor
    : null;
}

export async function claimSalesRepPhonePass(inviteToken: string): Promise<{
  sessionToken: string;
  actor: SalesRepActor;
}> {
  if (!isSalesAccessToken(inviteToken)) {
    throw new Error("This sales phone link is invalid or expired.");
  }

  const sessionToken = issueOpaqueSalesToken();
  const sessionExpiresAt = new Date(Date.now() + SALES_SESSION_TTL_MS);
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("claim_sales_rep_access_grant", {
      p_invite_token_hash: hashSalesAccessToken(inviteToken),
      p_session_token_hash: hashSalesAccessToken(sessionToken),
      p_session_expires_at: sessionExpiresAt.toISOString(),
    })
    .single();

  if (result.error || !result.data) {
    throw new Error(
      "This sales phone link is invalid, expired, revoked, or already used.",
    );
  }
  const row = result.data as ClaimRpcRow;
  return {
    sessionToken,
    actor: {
      kind: "sales_rep",
      grantId: row.grant_id,
      repId: row.rep_id,
      repSlug: row.rep_slug,
      displayName: row.display_name,
      sessionExpiresAt: row.session_expires_at,
    },
  };
}

export async function issueSalesRepPhonePass(input: {
  repSlug: string;
  issuedBy?: string;
}): Promise<{
  grantId: string;
  repSlug: string;
  displayName: string;
  inviteToken: string;
  inviteExpiresAt: string;
}> {
  const repSlug = normalizedRepSlug(input.repSlug);
  const issuedBy = normalizedText(input.issuedBy ?? "HomeAtlas HQ", 80);
  if (!repSlug || !issuedBy) {
    throw new Error("Choose a valid active sales representative.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const repResult = await supabase
    .from("sales_reps")
    .select("id, slug, display_name, role_title, status")
    .eq("slug", repSlug)
    .eq("status", "active")
    .maybeSingle();
  if (repResult.error || !repResult.data) {
    throw new Error("That sales representative is not active.");
  }
  const rep = repResult.data as SalesRepRow;
  const inviteToken = issueOpaqueSalesToken();
  const inviteExpiresAt = new Date(Date.now() + SALES_INVITE_TTL_MS);
  const result = await supabase
    .rpc("issue_sales_rep_access_grant", {
      p_rep_id: rep.id,
      p_invite_token_hash: hashSalesAccessToken(inviteToken),
      p_invite_expires_at: inviteExpiresAt.toISOString(),
      p_issued_by: issuedBy,
    })
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not create the phone pass.");
  }
  const row = result.data as {
    grant_id: string;
    rep_slug: string;
    display_name: string;
    invite_expires_at: string;
  };
  return {
    grantId: row.grant_id,
    repSlug: row.rep_slug,
    displayName: row.display_name,
    inviteToken,
    inviteExpiresAt: row.invite_expires_at,
  };
}

export async function revokeSalesRepPhonePass(
  grantId: string,
  revokedBy = "HomeAtlas HQ",
): Promise<{ grantId: string; revokedAt: string }> {
  if (!UUID_PATTERN.test(grantId) || !normalizedText(revokedBy, 80)) {
    throw new Error("Choose a valid phone pass to revoke.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("revoke_sales_rep_access_grant", {
      p_grant_id: grantId,
      p_revoked_by: revokedBy.trim(),
    })
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not revoke the phone pass.");
  }
  const row = result.data as { grant_id: string; revoked_at: string };
  return { grantId: row.grant_id, revokedAt: row.revoked_at };
}

export async function listSalesRepAccessRoster(): Promise<{
  reps: SalesRepAccessRosterMember[];
  grants: SalesRepAccessGrantView[];
}> {
  const supabase = createServiceRoleSupabaseClient();
  const [repResult, grantResult] = await Promise.all([
    supabase
      .from("sales_reps")
      .select("id, slug, display_name, role_title, status")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
    supabase
      .from("sales_rep_access_grants")
      .select(
        "id, rep_id, status, invite_expires_at, session_expires_at, claimed_at, revoked_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (repResult.error) {
    throw new Error("Could not load active sales representatives.");
  }
  if (grantResult.error) {
    throw new Error(
      "Sales phone-pass storage is not ready. Apply migration 067.",
    );
  }

  const grants = ((grantResult.data ?? []) as SalesRepAccessGrantRow[]).map(
    toGrantView,
  );
  const currentGrantByRep = new Map<string, SalesRepAccessGrantView>();
  for (const grant of grants) {
    if (
      !currentGrantByRep.has(grant.repId) &&
      (grant.status === "pending" || grant.status === "active")
    ) {
      currentGrantByRep.set(grant.repId, grant);
    }
  }

  return {
    reps: ((repResult.data ?? []) as SalesRepRow[]).map((rep) => ({
      repId: rep.id,
      repSlug: rep.slug,
      displayName: rep.display_name,
      roleTitle: rep.role_title,
      currentGrant: currentGrantByRep.get(rep.id) ?? null,
    })),
    grants,
  };
}
