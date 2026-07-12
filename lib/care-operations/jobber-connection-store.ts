import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  JOBBER_CONNECTION_ID,
  getJobberGraphqlVersion,
} from "./jobber-oauth-config";
import {
  decryptJobberToken,
  encryptJobberToken,
} from "./jobber-token-crypto";
import type {
  JobberAccountIdentity,
  JobberOAuthTokens,
} from "./jobber-api";
import { JobberApiError, refreshJobberTokens } from "./jobber-api";

interface StoredConnectionRow {
  id: string;
  status: "connected" | "refresh_required" | "disconnected" | "error";
  account_id: string;
  account_name: string;
  access_token_expires_at: string;
  graphql_version: string;
  connected_at: string;
  last_verified_at: string;
  last_refreshed_at: string | null;
  last_error_code: string | null;
}

interface StoredTokenRow extends StoredConnectionRow {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_generation: number;
}

export interface JobberConnectionStatus {
  connected: boolean;
  status: StoredConnectionRow["status"] | "not_connected";
  accountId: string | null;
  accountName: string | null;
  accessTokenExpiresAt: string | null;
  graphqlVersion: string;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  lastRefreshedAt: string | null;
  lastErrorCode: string | null;
}

export async function saveJobberConnection(input: {
  account: JobberAccountIdentity;
  tokens: JobberOAuthTokens;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("jobber_connections")
    .select("account_id, token_generation")
    .eq("id", JOBBER_CONNECTION_ID)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.account_id && existing.account_id !== input.account.id) {
    throw new Error("A different Jobber account is already connected");
  }

  const eventType = existing ? "reauthorized" : "connected";
  const { error: saveError } = await supabase.from("jobber_connections").upsert({
    id: JOBBER_CONNECTION_ID,
    status: "connected",
    account_id: input.account.id,
    account_name: input.account.name,
    access_token_ciphertext: encryptJobberToken(input.tokens.accessToken),
    refresh_token_ciphertext: encryptJobberToken(input.tokens.refreshToken),
    access_token_expires_at: input.tokens.accessTokenExpiresAt,
    token_generation: existing ? Number(existing.token_generation) + 1 : 1,
    graphql_version: getJobberGraphqlVersion(),
    ...(!existing ? { connected_at: now } : {}),
    last_verified_at: now,
    last_error_code: null,
    refresh_lease_id: null,
    refresh_lease_expires_at: null,
  });
  if (saveError) throw new Error(saveError.message);

  const { error: eventError } = await supabase
    .from("jobber_connection_events")
    .insert({
      connection_id: JOBBER_CONNECTION_ID,
      event_type: eventType,
      actor: "hq_oauth_callback",
      safe_details: {
        account_id: input.account.id,
        account_name: input.account.name,
        graphql_version: getJobberGraphqlVersion(),
      },
    });
  if (eventError) {
    console.error("[jobber-oauth] connection event write failed");
  }
}

export async function readJobberConnectionStatus(): Promise<JobberConnectionStatus> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("jobber_connections")
    .select(
      "id, status, account_id, account_name, access_token_expires_at, graphql_version, connected_at, last_verified_at, last_refreshed_at, last_error_code",
    )
    .eq("id", JOBBER_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as StoredConnectionRow | null;
  if (!row) {
    return {
      connected: false,
      status: "not_connected",
      accountId: null,
      accountName: null,
      accessTokenExpiresAt: null,
      graphqlVersion: getJobberGraphqlVersion(),
      connectedAt: null,
      lastVerifiedAt: null,
      lastRefreshedAt: null,
      lastErrorCode: null,
    };
  }
  return {
    connected: row.status === "connected",
    status: row.status,
    accountId: row.account_id,
    accountName: row.account_name,
    accessTokenExpiresAt: row.access_token_expires_at,
    graphqlVersion: row.graphql_version,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    lastRefreshedAt: row.last_refreshed_at,
    lastErrorCode: row.last_error_code,
  };
}

/**
 * Returns a usable access token for future read-only sync work. Refresh-token
 * rotation is serialized in Supabase so two workers cannot redeem the same
 * rotating token concurrently.
 */
export async function getFreshJobberAccessToken(): Promise<string> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("jobber_connections")
    .select(
      "id, status, account_id, account_name, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at, token_generation, graphql_version, connected_at, last_verified_at, last_refreshed_at, last_error_code",
    )
    .eq("id", JOBBER_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as StoredTokenRow | null;
  if (!row || row.status !== "connected") {
    throw new Error("Jobber is not connected");
  }
  if (new Date(row.access_token_expires_at).getTime() > Date.now() + 5 * 60_000) {
    return decryptJobberToken(row.access_token_ciphertext);
  }

  const leaseId = crypto.randomUUID();
  const { data: acquired, error: leaseError } = await supabase.rpc(
    "acquire_jobber_refresh_lease",
    { requested_lease_id: leaseId, lease_seconds: 30 },
  );
  if (leaseError) throw new Error(leaseError.message);
  if (!acquired) {
    throw new Error("Jobber token refresh is already in progress");
  }

  try {
    const tokens = await refreshJobberTokens(
      decryptJobberToken(row.refresh_token_ciphertext),
    );
    const refreshedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("jobber_connections")
      .update({
        access_token_ciphertext: encryptJobberToken(tokens.accessToken),
        refresh_token_ciphertext: encryptJobberToken(tokens.refreshToken),
        access_token_expires_at: tokens.accessTokenExpiresAt,
        token_generation: row.token_generation + 1,
        last_refreshed_at: refreshedAt,
        last_error_code: null,
        refresh_lease_id: null,
        refresh_lease_expires_at: null,
      })
      .eq("id", JOBBER_CONNECTION_ID)
      .eq("refresh_lease_id", leaseId)
      .eq("token_generation", row.token_generation)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Jobber token refresh lost its lease");

    const { error: eventError } = await supabase
      .from("jobber_connection_events")
      .insert({
        connection_id: JOBBER_CONNECTION_ID,
        event_type: "refreshed",
        actor: "homeatlas_token_manager",
        safe_details: { token_generation: row.token_generation + 1 },
      });
    if (eventError) {
      console.error("[jobber-oauth] refresh event write failed");
    }
    return tokens.accessToken;
  } catch (refreshError) {
    const invalidRefreshToken =
      refreshError instanceof JobberApiError &&
      (refreshError.status === 400 || refreshError.status === 401);
    await supabase
      .from("jobber_connections")
      .update({
        status: invalidRefreshToken ? "refresh_required" : "connected",
        last_error_code: invalidRefreshToken
          ? "jobber_reauthorization_required"
          : "jobber_refresh_failed",
        refresh_lease_id: null,
        refresh_lease_expires_at: null,
      })
      .eq("id", JOBBER_CONNECTION_ID)
      .eq("refresh_lease_id", leaseId);
    await supabase.from("jobber_connection_events").insert({
      connection_id: JOBBER_CONNECTION_ID,
      event_type: "refresh_failed",
      actor: "homeatlas_token_manager",
      safe_details: {
        reason: invalidRefreshToken
          ? "reauthorization_required"
          : "transient_refresh_failure",
      },
    });
    throw refreshError;
  }
}
