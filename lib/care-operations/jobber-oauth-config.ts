import "server-only";

export const JOBBER_AUTHORIZATION_URL =
  "https://api.getjobber.com/api/oauth/authorize";
export const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
export const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
export const JOBBER_OAUTH_STATE_COOKIE = "homeatlas_jobber_oauth_state";
export const JOBBER_CONNECTION_ID = "squeegeeking";
export const DEFAULT_JOBBER_GRAPHQL_VERSION = "2025-04-16";

export interface JobberConfigStatus {
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  encryptionKeyConfigured: boolean;
  redirectUriConfigured: boolean;
  configured: boolean;
}

function hasValidEncryptionKeyShape(value: string | undefined): boolean {
  const configured = value?.trim();
  if (!configured) return false;
  if (/^[a-f0-9]{64}$/i.test(configured)) return true;
  try {
    return Buffer.from(configured, "base64").length === 32;
  } catch {
    return false;
  }
}

export function getJobberConfigStatus(): JobberConfigStatus {
  const clientIdConfigured = Boolean(process.env.JOBBER_CLIENT_ID?.trim());
  const clientSecretConfigured = Boolean(
    process.env.JOBBER_CLIENT_SECRET?.trim(),
  );
  const encryptionKeyConfigured = hasValidEncryptionKeyShape(
    process.env.JOBBER_TOKEN_ENCRYPTION_KEY,
  );
  const redirectUriConfigured = Boolean(
    process.env.JOBBER_OAUTH_REDIRECT_URI?.trim(),
  );
  return {
    clientIdConfigured,
    clientSecretConfigured,
    encryptionKeyConfigured,
    redirectUriConfigured,
    configured:
      clientIdConfigured &&
      clientSecretConfigured &&
      encryptionKeyConfigured &&
      (process.env.NODE_ENV !== "production" || redirectUriConfigured),
  };
}

export function getJobberClientId(): string {
  const value = process.env.JOBBER_CLIENT_ID?.trim();
  if (!value) throw new Error("JOBBER_CLIENT_ID is not configured");
  return value;
}

export function getJobberClientSecret(): string {
  const value = process.env.JOBBER_CLIENT_SECRET?.trim();
  if (!value) throw new Error("JOBBER_CLIENT_SECRET is not configured");
  return value;
}

export function getJobberGraphqlVersion(): string {
  return (
    process.env.JOBBER_GRAPHQL_VERSION?.trim() ??
    DEFAULT_JOBBER_GRAPHQL_VERSION
  );
}

export function resolveJobberOAuthRedirectUri(request: Request): string {
  const configured = process.env.JOBBER_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("JOBBER_OAUTH_REDIRECT_URI is required in production");
  }

  return new URL(
    "/api/admin/care-operations/jobber/oauth/callback",
    request.url,
  ).toString();
}

export function suggestJobberOAuthRedirectUri(request: Request): string {
  const configured = process.env.JOBBER_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = appUrl || new URL(request.url).origin;
  return new URL(
    "/api/admin/care-operations/jobber/oauth/callback",
    origin,
  ).toString();
}

export function buildJobberAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(JOBBER_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
  }).toString();
  return url.toString();
}
