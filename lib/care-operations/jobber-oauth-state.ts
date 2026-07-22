import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { JOBBER_OAUTH_STATE_COOKIE } from "./jobber-oauth-config";

export function createJobberOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

interface JobberOAuthStateCookieJar {
  get(name: string): { value: string } | undefined;
  delete(name: string): void;
}

export async function writeJobberOAuthState(
  state: string,
  actorId: string,
): Promise<void> {
  const jar = await cookies();
  jar.set(JOBBER_OAUTH_STATE_COOKIE, JSON.stringify({ state, actorId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/care-operations/jobber/oauth",
    maxAge: 10 * 60,
  });
}

export async function consumeJobberOAuthState(
  returnedState: string,
  actorId: string,
  cookieJarOverride?: JobberOAuthStateCookieJar,
): Promise<boolean> {
  const jar = cookieJarOverride ?? (await cookies());
  const serialized = jar.get(JOBBER_OAUTH_STATE_COOKIE)?.value ?? "";
  jar.delete(JOBBER_OAUTH_STATE_COOKIE);
  let expected = "";
  try {
    const stored = JSON.parse(serialized) as {
      state?: unknown;
      actorId?: unknown;
    };
    if (stored.actorId !== actorId || typeof stored.state !== "string") {
      return false;
    }
    expected = stored.state;
  } catch {
    return false;
  }
  if (!expected || !returnedState) return false;
  const expectedBytes = Buffer.from(expected);
  const returnedBytes = Buffer.from(returnedState);
  return (
    expectedBytes.length === returnedBytes.length &&
    timingSafeEqual(expectedBytes, returnedBytes)
  );
}
