import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { getGoogleOAuthClientId, getGoogleOAuthClientSecret } from "./google-oauth-config";
import type { GoogleOAuthSession } from "./google-oauth-session";
import { decryptGoogleToken, encryptGoogleToken } from "./google-token-crypto";

export const GOOGLE_BUSINESS_CONNECTION_ID = "squeegeeking";

type GoogleConnectionState =
  | "connected"
  | "refresh_required"
  | "disconnected"
  | "error";

interface GoogleConnectionRow {
  id: string;
  status: GoogleConnectionState;
  account_name: string;
  location_name: string;
  location_title: string;
  place_id: string | null;
  oauth_email: string | null;
  access_token_expires_at: string;
  token_generation: number;
  connection_revision: string;
  connected_at: string;
  last_verified_at: string;
  last_refreshed_at: string | null;
  last_full_sync_at: string | null;
  last_full_review_count: number | null;
  last_error_code: string | null;
}

interface GoogleConnectionTokenRow extends GoogleConnectionRow {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
}

export interface GoogleBusinessConnectionStatus {
  connected: boolean;
  status: GoogleConnectionState | "not_connected";
  accountName: string | null;
  locationName: string | null;
  locationTitle: string | null;
  placeId: string | null;
  oauthEmail: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  lastRefreshedAt: string | null;
  lastFullSyncAt: string | null;
  lastFullReviewCount: number | null;
  lastErrorCode: string | null;
}

export interface GoogleBusinessConnectionIdentity {
  accountName: string;
  locationName: string;
  locationTitle: string;
  placeId: string | null;
  oauthEmail: string;
}

export interface FreshGoogleBusinessConnection {
  identity: GoogleBusinessConnectionIdentity;
  accessToken: string;
  tokenGeneration: number;
  connectionRevision: string;
}

function emptyStatus(): GoogleBusinessConnectionStatus {
  return {
    connected: false,
    status: "not_connected",
    accountName: null,
    locationName: null,
    locationTitle: null,
    placeId: null,
    oauthEmail: null,
    connectedAt: null,
    lastVerifiedAt: null,
    lastRefreshedAt: null,
    lastFullSyncAt: null,
    lastFullReviewCount: null,
    lastErrorCode: null,
  };
}

function toStatus(row: GoogleConnectionRow | null): GoogleBusinessConnectionStatus {
  if (!row) return emptyStatus();
  return {
    connected: row.status === "connected",
    status: row.status,
    accountName: row.account_name,
    locationName: row.location_name,
    locationTitle: row.location_title,
    placeId: row.place_id,
    oauthEmail: row.oauth_email,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    lastRefreshedAt: row.last_refreshed_at,
    lastFullSyncAt: row.last_full_sync_at,
    lastFullReviewCount: row.last_full_review_count,
    lastErrorCode: row.last_error_code,
  };
}

export async function saveGoogleBusinessConnection(input: {
  identity: GoogleBusinessConnectionIdentity;
  session: GoogleOAuthSession;
}): Promise<{ tokenGeneration: number; connectionRevision: string }> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("google_business_connections")
    .select(
      "status, account_name, location_name, place_id, oauth_email, refresh_token_ciphertext, token_generation",
    )
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const existingRow = existing as
    | {
        status?: GoogleConnectionState;
        account_name?: string;
        location_name?: string;
        place_id?: string | null;
        oauth_email?: string;
        refresh_token_ciphertext?: string;
        token_generation?: number;
      }
    | null;
  const normalizedEmail = input.identity.oauthEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Google account email could not be verified. Sign in again.");
  }
  const sameDurableIdentity = Boolean(
    existingRow?.status === "connected" &&
      existingRow.account_name === input.identity.accountName &&
      existingRow.location_name === input.identity.locationName &&
      existingRow.oauth_email?.trim().toLowerCase() === normalizedEmail,
  );
  const refreshTokenCiphertext = input.session.refreshToken
    ? encryptGoogleToken(input.session.refreshToken)
    : sameDurableIdentity
      ? existingRow?.refresh_token_ciphertext
      : undefined;

  if (!refreshTokenCiphertext) {
    throw new Error(
      "Google did not return an offline refresh token. Reconnect Google and approve access again.",
    );
  }

  const tokenGeneration = Number(existingRow?.token_generation ?? 0) + 1;
  const connectionRevision = crypto.randomUUID();

  const { error: saveError } = await supabase
    .from("google_business_connections")
    .upsert({
      id: GOOGLE_BUSINESS_CONNECTION_ID,
      status: "connected",
      account_name: input.identity.accountName,
      location_name: input.identity.locationName,
      location_title: input.identity.locationTitle,
      place_id:
        input.identity.placeId?.trim() ||
        (sameDurableIdentity ? existingRow?.place_id?.trim() || null : null),
      oauth_email: normalizedEmail,
      access_token_ciphertext: encryptGoogleToken(input.session.accessToken),
      refresh_token_ciphertext: refreshTokenCiphertext,
      access_token_expires_at: new Date(input.session.expiresAt).toISOString(),
      token_generation: tokenGeneration,
      connection_revision: connectionRevision,
      ...(!existingRow || !sameDurableIdentity ? { connected_at: now } : {}),
      ...(!sameDurableIdentity
        ? {
            last_refreshed_at: null,
            last_full_sync_at: null,
            last_full_review_count: null,
          }
        : {}),
      last_verified_at: now,
      last_error_code: null,
    });
  if (saveError) throw new Error(saveError.message);
  return { tokenGeneration, connectionRevision };
}

export async function readGoogleBusinessConnectionStatus(): Promise<GoogleBusinessConnectionStatus> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("google_business_connections")
    .select(
      "id, status, account_name, location_name, location_title, place_id, oauth_email, access_token_expires_at, token_generation, connection_revision, connected_at, last_verified_at, last_refreshed_at, last_full_sync_at, last_full_review_count, last_error_code",
    )
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toStatus(data as GoogleConnectionRow | null);
}

export async function readGoogleBusinessConnectionIdentity(): Promise<GoogleBusinessConnectionIdentity> {
  const status = await readGoogleBusinessConnectionStatus();
  if (
    !status.connected ||
    !status.accountName ||
    !status.locationName ||
    !status.locationTitle
  ) {
    throw new Error("Google Business Profile is not connected for full reviews");
  }
  return {
    accountName: status.accountName,
    locationName: status.locationName,
    locationTitle: status.locationTitle,
    placeId: status.placeId,
    oauthEmail: status.oauthEmail ?? "",
  };
}

export async function readGoogleBusinessConnectionRevision(): Promise<string> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("google_business_connections")
    .select("status, connection_revision, last_error_code, last_verified_at")
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.status !== "connected" || !data.connection_revision) {
    throw new Error("Google Business Profile is not connected for full reviews");
  }
  const lastAttemptAt = data.last_verified_at
    ? Date.parse(String(data.last_verified_at))
    : Number.NaN;
  if (
    data.last_error_code === "google_business_reviews_unavailable" &&
    Number.isFinite(lastAttemptAt) &&
    Date.now() - lastAttemptAt < 5 * 60 * 1000
  ) {
    throw new Error("Google Business review sync is in a short retry backoff");
  }
  return String(data.connection_revision);
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: string;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleOAuthClientId(),
      client_secret: getGoogleOAuthClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const error = new Error(`Google OAuth refresh failed (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Google OAuth refresh returned an incomplete token response");
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

function identityFromRow(
  row: GoogleConnectionRow,
): GoogleBusinessConnectionIdentity {
  return {
    accountName: row.account_name,
    locationName: row.location_name,
    locationTitle: row.location_title,
    placeId: row.place_id,
    oauthEmail: row.oauth_email ?? "",
  };
}

async function markGoogleTokenDecryptFailure(
  row: GoogleConnectionTokenRow,
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  await supabase
    .from("google_business_connections")
    .update({
      status: "error",
      last_error_code: "google_token_decrypt_failed",
    })
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .eq("token_generation", row.token_generation)
    .eq("connection_revision", row.connection_revision);
}

async function loadFreshGoogleBusinessConnection(
  raceRetry = 0,
): Promise<FreshGoogleBusinessConnection> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("google_business_connections")
    .select(
      "id, status, account_name, location_name, location_title, place_id, oauth_email, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at, token_generation, connection_revision, connected_at, last_verified_at, last_refreshed_at, last_full_sync_at, last_full_review_count, last_error_code",
    )
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = data as GoogleConnectionTokenRow | null;
  if (!row || row.status !== "connected") {
    throw new Error("Google Business Profile is not connected for full reviews");
  }

  if (new Date(row.access_token_expires_at).getTime() > Date.now() + 5 * 60_000) {
    try {
      return {
        identity: identityFromRow(row),
        accessToken: decryptGoogleToken(row.access_token_ciphertext),
        tokenGeneration: row.token_generation,
        connectionRevision: row.connection_revision,
      };
    } catch (decryptError) {
      await markGoogleTokenDecryptFailure(row);
      throw decryptError;
    }
  }

  try {
    let refreshToken: string;
    try {
      refreshToken = decryptGoogleToken(row.refresh_token_ciphertext);
    } catch (decryptError) {
      await markGoogleTokenDecryptFailure(row);
      Object.assign(decryptError as object, {
        googleTokenDecryptFailure: true,
      });
      throw decryptError;
    }
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const refreshedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("google_business_connections")
      .update({
        access_token_ciphertext: encryptGoogleToken(refreshed.accessToken),
        access_token_expires_at: refreshed.expiresAt,
        token_generation: row.token_generation + 1,
        last_refreshed_at: refreshedAt,
        last_error_code: null,
      })
      .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
      .eq("token_generation", row.token_generation)
      .eq("connection_revision", row.connection_revision)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);

    if (!updated) {
      if (raceRetry >= 2) {
        throw new Error("Google OAuth token refresh lost its update race");
      }
      return loadFreshGoogleBusinessConnection(raceRetry + 1);
    }

    return {
      identity: identityFromRow(row),
      accessToken: refreshed.accessToken,
      tokenGeneration: row.token_generation + 1,
      connectionRevision: row.connection_revision,
    };
  } catch (refreshError) {
    if (
      (refreshError as Error & { googleTokenDecryptFailure?: boolean })
        .googleTokenDecryptFailure
    ) {
      throw refreshError;
    }
    const status = Number(
      (refreshError as Error & { status?: number }).status ?? 0,
    );
    const refreshRequired = status === 400 || status === 401;
    await supabase
      .from("google_business_connections")
      .update({
        status: refreshRequired ? "refresh_required" : "connected",
        last_error_code: refreshRequired
          ? "google_reauthorization_required"
          : "google_refresh_failed",
      })
      .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
      .eq("token_generation", row.token_generation)
      .eq("connection_revision", row.connection_revision);
    throw refreshError;
  }
}

export async function getFreshGoogleBusinessConnection(): Promise<FreshGoogleBusinessConnection> {
  return loadFreshGoogleBusinessConnection();
}

export async function getFreshGoogleBusinessAccessToken(): Promise<string> {
  return (await getFreshGoogleBusinessConnection()).accessToken;
}

export async function recordGoogleBusinessSyncResult(input: {
  reviewCount?: number;
  errorCode?: string;
  tokenGeneration?: number;
  connectionRevision?: string;
}): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const update = {
    last_verified_at: now,
    ...(input.reviewCount !== undefined
      ? {
          last_full_sync_at: now,
          last_full_review_count: input.reviewCount,
        }
      : {}),
    last_error_code: input.errorCode ?? null,
  };
  let query = supabase
    .from("google_business_connections")
    .update(update)
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .eq("status", "connected");
  if (input.tokenGeneration !== undefined) {
    query = query.eq("token_generation", input.tokenGeneration);
  }
  if (input.connectionRevision !== undefined) {
    query = query.eq("connection_revision", input.connectionRevision);
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) {
    console.error("[google-reviews] connection sync status update failed");
    return false;
  }
  return Boolean(data);
}

export async function disconnectGoogleBusinessConnection(input?: {
  additionalToken?: string;
}): Promise<{
  providerRevoked: boolean;
  durableCredentialFound: boolean;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("google_business_connections")
    .select("refresh_token_ciphertext")
    .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const encryptedRefreshToken = data?.refresh_token_ciphertext
    ? String(data.refresh_token_ciphertext)
    : null;
  const durableCredentialFound = Boolean(encryptedRefreshToken);

  if (data) {
    const { error: disableError } = await supabase
      .from("google_business_connections")
      .update({
        status: "disconnected",
        last_error_code: "google_revocation_pending",
        connection_revision: crypto.randomUUID(),
      })
      .eq("id", GOOGLE_BUSINESS_CONNECTION_ID);
    if (disableError) throw new Error(disableError.message);
  }

  const tokens = new Set<string>();
  let durableTokenReadable = true;
  if (encryptedRefreshToken) {
    try {
      tokens.add(decryptGoogleToken(encryptedRefreshToken));
    } catch {
      durableTokenReadable = false;
    }
  }
  if (input?.additionalToken?.trim()) {
    tokens.add(input.additionalToken.trim());
  }

  const revokeResults = await Promise.all(
    [...tokens].map(async (token) => {
      try {
        const response = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        return response.ok;
      } catch {
        return false;
      }
    }),
  );
  const providerRevoked =
    durableTokenReadable && revokeResults.every(Boolean);

  if (data && providerRevoked) {
    const { error: deleteError } = await supabase
      .from("google_business_connections")
      .delete()
      .eq("id", GOOGLE_BUSINESS_CONNECTION_ID)
      .eq("status", "disconnected");
    if (deleteError) throw new Error(deleteError.message);
  }

  return { providerRevoked, durableCredentialFound };
}
