export const GOOGLE_BUSINESS_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/business.manage";

export const GOOGLE_OAUTH_COOKIE = "squeegeeking_google_business_oauth";
export const GOOGLE_OAUTH_STATE_COOKIE = "squeegeeking_google_oauth_state";

export function isGoogleBusinessOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
  );
}

export function getGoogleOAuthClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured");
  return id;
}

export function getGoogleOAuthClientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not configured");
  return secret;
}

export function resolveGoogleOAuthRedirectUri(request: Request): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;

  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}/api/admin/google-reviews/oauth/callback`;
}
