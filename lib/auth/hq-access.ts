import "server-only";

import { createCookieAwareSupabaseServerClient } from "@/lib/auth/supabase-server";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export type HqActorRole = "owner" | "operator";

export interface HqActor {
  id: string;
  email: string;
  role: HqActorRole;
}

export type HqAccessStatus = 401 | 403 | 503;

export class HqAccessError extends Error {
  constructor(
    public readonly status: HqAccessStatus,
    message: string,
  ) {
    super(message);
    this.name = "HqAccessError";
  }
}

interface AuthUserResult {
  data: { user: { id: string; email?: string } | null };
  error: {
    status?: number;
    name?: string;
    code?: string;
    message?: string;
  } | null;
}

export interface HqAuthClient {
  auth: {
    getUser(): Promise<AuthUserResult>;
  };
}

interface HqAdminUserRow {
  user_id: string;
  email: string;
  role: HqActorRole;
  active: boolean;
}

interface AdminLookupResult {
  data: HqAdminUserRow | null;
  error: { message: string } | null;
}

export interface HqAdminLookupClient {
  from(table: "hq_admin_users"): {
    select(columns: string): {
      eq(column: "user_id", value: string): {
        maybeSingle(): PromiseLike<AdminLookupResult>;
      };
    };
  };
}

function isMissingOrInvalidSession(error: AuthUserResult["error"]): boolean {
  if (!error) return false;
  const invalidSessionCodes = new Set([
    "bad_jwt",
    "invalid_jwt",
    "no_authorization",
    "session_not_found",
    "session_expired",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "user_not_found",
  ]);
  return (
    error.name === "AuthSessionMissingError" ||
    error.name === "AuthInvalidJwtError" ||
    (typeof error.code === "string" && invalidSessionCodes.has(error.code))
  );
}

export async function requireHqActorWithClients(
  authClient: HqAuthClient,
  adminClient: HqAdminLookupClient,
): Promise<HqActor> {
  let authResult: AuthUserResult;
  try {
    authResult = await authClient.auth.getUser();
  } catch {
    throw new HqAccessError(503, "Headquarters authentication is unavailable");
  }

  if (authResult.error) {
    const invalidSession = isMissingOrInvalidSession(authResult.error);
    throw new HqAccessError(
      invalidSession ? 401 : 503,
      invalidSession
        ? "Authentication required"
        : "Headquarters authentication is unavailable",
    );
  }

  if (!authResult.data.user) {
    throw new HqAccessError(401, "Authentication required");
  }

  let lookup: AdminLookupResult;
  try {
    lookup = await adminClient
      .from("hq_admin_users")
      .select("user_id, email, role, active")
      .eq("user_id", authResult.data.user.id)
      .maybeSingle();
  } catch {
    throw new HqAccessError(503, "Headquarters authorization is unavailable");
  }

  if (lookup.error) {
    throw new HqAccessError(503, "Headquarters authorization is unavailable");
  }

  const row = lookup.data;
  if (!row || !row.active) {
    throw new HqAccessError(403, "Headquarters access is not active");
  }
  if (
    row.user_id !== authResult.data.user.id ||
    (row.role !== "owner" && row.role !== "operator")
  ) {
    throw new HqAccessError(503, "Headquarters authorization is invalid");
  }
  const authenticatedEmail = authResult.data.user.email?.trim().toLowerCase();
  if (!row.email || !authenticatedEmail || row.email !== authenticatedEmail) {
    throw new HqAccessError(403, "Headquarters identity is not approved");
  }

  return { id: row.user_id, email: row.email, role: row.role };
}

/**
 * Verifies the Supabase session with Auth, then authorizes it against the
 * service-role-only Headquarters allowlist. Missing configuration and lookup
 * failures never grant access.
 */
export async function requireHqActor(): Promise<HqActor> {
  try {
    const [authClient, adminClient] = await Promise.all([
      createCookieAwareSupabaseServerClient(),
      Promise.resolve(createServiceRoleSupabaseClient()),
    ]);
    return await requireHqActorWithClients(
      authClient as unknown as HqAuthClient,
      adminClient as unknown as HqAdminLookupClient,
    );
  } catch (error) {
    if (error instanceof HqAccessError) throw error;
    throw new HqAccessError(503, "Headquarters access is unavailable");
  }
}
