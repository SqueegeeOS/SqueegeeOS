import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  JOBBER_OAUTH_RETURN_COOKIE,
  JOBBER_OAUTH_STATE_COOKIE,
  JOBBER_OAUTH_VERIFIER_COOKIE,
} from "./jobber-oauth-config";
import { resolveJobberHandoffResumePath } from "./jobber-handoff-navigation";

export interface ConsumedJobberOAuthState {
  codeVerifier: string;
  returnTo: string | null;
}

export function createJobberOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function createJobberPkce(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(64).toString("base64url");
  return {
    codeVerifier,
    codeChallenge: createHash("sha256")
      .update(codeVerifier)
      .digest("base64url"),
  };
}

function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/admin/care-operations/jobber/oauth",
    maxAge: 10 * 60,
  };
}

export async function writeJobberOAuthState(
  state: string,
  codeVerifier: string,
  returnTo?: string | null,
): Promise<void> {
  const jar = await cookies();
  jar.set(JOBBER_OAUTH_STATE_COOKIE, state, oauthCookieOptions());
  jar.set(JOBBER_OAUTH_VERIFIER_COOKIE, codeVerifier, oauthCookieOptions());
  const safeReturnTo = resolveJobberHandoffResumePath(returnTo);
  if (safeReturnTo) {
    jar.set(JOBBER_OAUTH_RETURN_COOKIE, safeReturnTo, oauthCookieOptions());
  } else {
    jar.delete(JOBBER_OAUTH_RETURN_COOKIE);
  }
}

export async function consumeJobberOAuthState(
  returnedState: string,
): Promise<ConsumedJobberOAuthState | null> {
  const jar = await cookies();
  const expected = jar.get(JOBBER_OAUTH_STATE_COOKIE)?.value ?? "";
  const codeVerifier = jar.get(JOBBER_OAUTH_VERIFIER_COOKIE)?.value ?? "";
  const returnTo = resolveJobberHandoffResumePath(
    jar.get(JOBBER_OAUTH_RETURN_COOKIE)?.value,
  );
  jar.delete(JOBBER_OAUTH_STATE_COOKIE);
  jar.delete(JOBBER_OAUTH_VERIFIER_COOKIE);
  jar.delete(JOBBER_OAUTH_RETURN_COOKIE);
  if (
    !expected ||
    !returnedState ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
  ) {
    return null;
  }
  const expectedBytes = Buffer.from(expected);
  const returnedBytes = Buffer.from(returnedState);
  const stateMatches =
    expectedBytes.length === returnedBytes.length &&
    timingSafeEqual(expectedBytes, returnedBytes);
  return stateMatches ? { codeVerifier, returnTo } : null;
}
