import { NextResponse } from "next/server";
import { ROUTES } from "@/lib/navigation/config";
import { resolveGoogleOAuthRedirectUri } from "@/lib/reviews/google-oauth-config";
import {
  exchangeGoogleOAuthCode,
  readAndClearOAuthState,
  writeGoogleOAuthSession,
} from "@/lib/reviews/google-oauth-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const wizardUrl = new URL(ROUTES.setupGoogleReviews, url.origin);

  const expectedState = await readAndClearOAuthState(state);
  if (!state || !expectedState || expectedState !== state) {
    wizardUrl.searchParams.set("oauth", "error");
    wizardUrl.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(wizardUrl);
  }

  if (oauthError) {
    wizardUrl.searchParams.set("oauth", "error");
    wizardUrl.searchParams.set("message", "google_authorization_denied");
    return NextResponse.redirect(wizardUrl);
  }

  if (!code) {
    wizardUrl.searchParams.set("oauth", "error");
    wizardUrl.searchParams.set("message", "missing_code");
    return NextResponse.redirect(wizardUrl);
  }

  try {
    const redirectUri = resolveGoogleOAuthRedirectUri(request);
    const session = await exchangeGoogleOAuthCode(code, redirectUri);
    await writeGoogleOAuthSession(session);
    wizardUrl.searchParams.set("oauth", "connected");
    return NextResponse.redirect(wizardUrl);
  } catch {
    wizardUrl.searchParams.set("oauth", "error");
    wizardUrl.searchParams.set("message", "token_exchange_failed");
    return NextResponse.redirect(wizardUrl);
  }
}
