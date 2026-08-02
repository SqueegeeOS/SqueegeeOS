import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  getGoogleOAuthClientId,
  getGoogleOAuthScopeString,
  isGoogleBusinessOAuthConfigured,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/reviews/google-oauth-config";
import { writeOAuthState } from "@/lib/reviews/google-oauth-session";
import { getGoogleTokenEncryptionKeyStatus } from "@/lib/reviews/google-token-crypto";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleBusinessOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Business OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  if (!getGoogleTokenEncryptionKeyStatus().ready) {
    return NextResponse.json(
      {
        error:
          "Configure a valid 32-byte GOOGLE_TOKEN_ENCRYPTION_KEY (or JOBBER_TOKEN_ENCRYPTION_KEY) before Google sign-in.",
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
