import { NextResponse } from "next/server";
import {
  getGoogleOAuthClientId,
  getGoogleOAuthScopeString,
  isGoogleBusinessOAuthConfigured,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/reviews/google-oauth-config";
import { writeOAuthState } from "@/lib/reviews/google-oauth-session";

export async function GET(request: Request) {
  if (!isGoogleBusinessOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Business OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const state = crypto.randomUUID();
  await writeOAuthState(state);

  const redirectUri = resolveGoogleOAuthRedirectUri(request);
  const params = new URLSearchParams({
    client_id: getGoogleOAuthClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: getGoogleOAuthScopeString(),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
