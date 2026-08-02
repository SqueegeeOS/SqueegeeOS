import { cookies } from "next/headers";
import {
  getGoogleOAuthClientSecret,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "./google-oauth-config";
import { decryptGoogleToken, encryptGoogleToken } from "./google-token-crypto";

export interface GoogleOAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

function encryptSessionJson(data: unknown): string {
  return encryptGoogleToken(JSON.stringify(data));
}

function decryptSessionJson<T>(value: string): T | null {
  try {
    return JSON.parse(decryptGoogleToken(value)) as T;
  } catch {
    return null;
  }
}

const GOOGLE_OAUTH_API_PATH = "/api/admin/google-reviews";
const GOOGLE_OAUTH_CALLBACK_PATH = `${GOOGLE_OAUTH_API_PATH}/oauth`;

export async function readGoogleOAuthSession(): Promise<GoogleOAuthSession | null> {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!raw) return null;

  const session = decryptSessionJson<GoogleOAuthSession>(raw);
  if (!session?.accessToken) return null;

  if (session.expiresAt <= Date.now()) {
    if (!session.refreshToken) return null;
    return refreshGoogleOAuthSession(session);
  }

  return session;
}

export async function writeGoogleOAuthSession(
  session: GoogleOAuthSession,
): Promise<void> {
  const jar = await cookies();
  jar.set(GOOGLE_OAUTH_COOKIE, encryptSessionJson(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_API_PATH,
    maxAge: 60 * 60,
  });
}

export async function clearGoogleOAuthSession(): Promise<void> {
  const jar = await cookies();
  jar.set(GOOGLE_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_API_PATH,
    maxAge: 0,
  });
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_CALLBACK_PATH,
    maxAge: 0,
  });
}

export async function writeOAuthState(state: string): Promise<void> {
  const jar = await cookies();
  const existingRaw = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const existingStates = existingRaw
    ? decryptSessionJson<string[]>(existingRaw) ?? []
    : [];
  const states = [...existingStates.filter((value) => value !== state), state]
    .slice(-4);
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, encryptSessionJson(states), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_CALLBACK_PATH,
    maxAge: 10 * 60,
  });
}

export async function readAndClearOAuthState(
  requestedState?: string | null,
): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const states = raw ? decryptSessionJson<string[]>(raw) ?? [] : [];
  const state = requestedState
    ? states.find((value) => value === requestedState) ?? null
    : states.at(-1) ?? null;
  const remaining = state ? states.filter((value) => value !== state) : states;
  jar.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    remaining.length > 0 ? encryptSessionJson(remaining) : "",
    {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_CALLBACK_PATH,
      maxAge: remaining.length > 0 ? 10 * 60 : 0,
    },
  );
  return state;
}

export async function readGoogleOAuthSessionForRevocation(): Promise<GoogleOAuthSession | null> {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_OAUTH_COOKIE)?.value;
  return raw ? decryptSessionJson<GoogleOAuthSession>(raw) : null;
}

export async function refreshGoogleOAuthSession(
  session: GoogleOAuthSession,
): Promise<GoogleOAuthSession | null> {
  if (!session.refreshToken) return null;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    client_secret: getGoogleOAuthClientSecret(),
    refresh_token: session.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  const next: GoogleOAuthSession = {
    ...session,
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  await writeGoogleOAuthSession(next);
  return next;
}

export async function exchangeGoogleOAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleOAuthSession> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    client_secret: getGoogleOAuthClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "OAuth token exchange failed");
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  let email: string | undefined;
  try {
    const userinfo = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${payload.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (userinfo.ok) {
      const profile = (await userinfo.json()) as { email?: string };
      email = profile.email;
    }
  } catch {
    // optional
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    email,
  };
}
