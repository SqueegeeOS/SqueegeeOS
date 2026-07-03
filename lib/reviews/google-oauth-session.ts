import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  getGoogleOAuthClientSecret,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "./google-oauth-config";

export interface GoogleOAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

function signPayload(payload: string): string {
  const secret = getGoogleOAuthClientSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeSignedJson(data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function decodeSignedJson<T>(value: string): T | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function readGoogleOAuthSession(): Promise<GoogleOAuthSession | null> {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!raw) return null;

  const session = decodeSignedJson<GoogleOAuthSession>(raw);
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
  jar.set(GOOGLE_OAUTH_COOKIE, encodeSignedJson(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function clearGoogleOAuthSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(GOOGLE_OAUTH_COOKIE);
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE);
}

export async function writeOAuthState(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function readAndClearOAuthState(): Promise<string | null> {
  const jar = await cookies();
  const state = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return state;
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
