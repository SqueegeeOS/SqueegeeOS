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

interface JobberConnectionPersistenceClient {
  rpc(
    name: "save_jobber_connection_with_event",
    args: {
      requested_account_id: string;
      requested_account_name: string;
      requested_access_token_ciphertext: string;
      requested_refresh_token_ciphertext: string;
      requested_access_token_expires_at: string;
      requested_graphql_version: string;
      requested_actor_id: string;
    },
  ): PromiseLike<{ error: { message: string } | null }>;
}

interface JobberRefreshPersistenceClient {
  rpc(
    name:
      | "acquire_jobber_refresh_lease_for_generation"
      | "complete_jobber_refresh_with_event"
      | "fail_jobber_refresh_with_event",
    args: Record<string, string | number | boolean>,
  ): PromiseLike<{
    data: boolean | null;
    error: { message: string } | null;
  }>;
}

async function runJobberRefreshRpc(
  client: JobberRefreshPersistenceClient,
  name:
    | "acquire_jobber_refresh_lease_for_generation"
    | "complete_jobber_refresh_with_event"
    | "fail_jobber_refresh_with_event",
  args: Record<string, string | number | boolean>,
): Promise<boolean> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data === true;
}

export function acquireJobberRefreshLease(
  client: JobberRefreshPersistenceClient,
  input: { leaseId: string; tokenGeneration: number },
): Promise<boolean> {
  return runJobberRefreshRpc(
    client,
    "acquire_jobber_refresh_lease_for_generation",
    {
      requested_lease_id: input.leaseId,
      requested_token_generation: input.tokenGeneration,
      lease_seconds: 30,
    },
  );
}

export function persistJobberRefreshSuccess(
  client: JobberRefreshPersistenceClient,
  input: {
    leaseId: string;
    tokenGeneration: number;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    accessTokenExpiresAt: string;
  },
): Promise<boolean> {
  return runJobberRefreshRpc(client, "complete_jobber_refresh_with_event", {
    requested_lease_id: input.leaseId,
    requested_token_generation: input.tokenGeneration,
    requested_access_token_ciphertext: input.accessTokenCiphertext,
    requested_refresh_token_ciphertext: input.refreshTokenCiphertext,
    requested_access_token_expires_at: input.accessTokenExpiresAt,
  });
}

export function persistJobberRefreshFailure(
  client: JobberRefreshPersistenceClient,
  input: {
    leaseId: string;
    tokenGeneration: number;
    reauthorizationRequired: boolean;
  },
): Promise<boolean> {
  return runJobberRefreshRpc(client, "fail_jobber_refresh_with_event", {
    requested_lease_id: input.leaseId,
    requested_token_generation: input.tokenGeneration,
    requested_reauthorization_required: input.reauthorizationRequired,
  });
}

export async function refreshLeasedJobberConnection(
  input: {
    client: JobberRefreshPersistenceClient;
    leaseId: string;
    tokenGeneration: number;
    refreshTokenCiphertext: string;
  },
  dependencies: {
    refreshTokens?: typeof refreshJobberTokens;
    decryptToken?: typeof decryptJobberToken;
    encryptToken?: typeof encryptJobberToken;
    persistSuccess?: typeof persistJobberRefreshSuccess;
    persistFailure?: typeof persistJobberRefreshFailure;
    beforeProviderRequest?: () => Promise<void>;
  } = {},
): Promise<string> {
  const refreshTokens = dependencies.refreshTokens ?? refreshJobberTokens;
  const decryptToken = dependencies.decryptToken ?? decryptJobberToken;
  const encryptToken = dependencies.encryptToken ?? encryptJobberToken;
  const persistSuccess =
    dependencies.persistSuccess ?? persistJobberRefreshSuccess;
  const persistFailure =
    dependencies.persistFailure ?? persistJobberRefreshFailure;

  await dependencies.beforeProviderRequest?.();
  let tokens: JobberOAuthTokens;
  try {
    tokens = await refreshTokens(decryptToken(input.refreshTokenCiphertext));
  } catch (refreshError) {
    const invalidRefreshToken =
      refreshError instanceof JobberApiError &&
      (refreshError.status === 400 || refreshError.status === 401);
    const recorded = await persistFailure(input.client, {
      leaseId: input.leaseId,
      tokenGeneration: input.tokenGeneration,
      reauthorizationRequired: invalidRefreshToken,
    });
    if (!recorded) {
      throw new Error(
        "Jobber token refresh lost its lease to newer connection state",
      );
    }
    throw refreshError;
  }

  const updated = await persistSuccess(input.client, {
    leaseId: input.leaseId,
    tokenGeneration: input.tokenGeneration,
    accessTokenCiphertext: encryptToken(tokens.accessToken),
    refreshTokenCiphertext: encryptToken(tokens.refreshToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  });
  if (!updated) {
    throw new Error(
      "Jobber token refresh lost its lease to newer connection state",
    );
  }
  return tokens.accessToken;
}

export async function saveJobberConnection(input: {
  account: JobberAccountIdentity;
  tokens: JobberOAuthTokens;
  actorId: string;
}, overrides?: {
  client?: JobberConnectionPersistenceClient;
  encryptToken?: (plaintext: string) => string;
}): Promise<void> {
  const client =
    overrides?.client ??
    (createServiceRoleSupabaseClient() as unknown as JobberConnectionPersistenceClient);
  const encryptToken = overrides?.encryptToken ?? encryptJobberToken;
  const { error } = await client.rpc("save_jobber_connection_with_event", {
    requested_account_id: input.account.id,
    requested_account_name: input.account.name,
    requested_access_token_ciphertext: encryptToken(input.tokens.accessToken),
    requested_refresh_token_ciphertext: encryptToken(input.tokens.refreshToken),
    requested_access_token_expires_at: input.tokens.accessTokenExpiresAt,
    requested_graphql_version: getJobberGraphqlVersion(),
    requested_actor_id: input.actorId,
  });
  if (error) throw new Error(error.message);
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
export async function getFreshJobberAccessToken(
  options: { beforeProviderRequest?: () => Promise<void> } = {},
): Promise<string> {
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
  const refreshPersistence =
    supabase as unknown as JobberRefreshPersistenceClient;
  const acquired = await acquireJobberRefreshLease(refreshPersistence, {
    leaseId,
    tokenGeneration: row.token_generation,
  });
  if (!acquired) {
    throw new Error(
      "Jobber token refresh lease was unavailable or connection state changed",
    );
  }

  return refreshLeasedJobberConnection({
    client: refreshPersistence,
    leaseId,
    tokenGeneration: row.token_generation,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
  }, {
    beforeProviderRequest: options.beforeProviderRequest,
  });
}
