import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { JOBBER_OAUTH_STATE_COOKIE } from "./jobber-oauth-config";

export function createJobberOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export async function writeJobberOAuthState(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(JOBBER_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/care-operations/jobber/oauth",
    maxAge: 10 * 60,
  });
}

export async function consumeJobberOAuthState(
  returnedState: string,
): Promise<boolean> {
  const jar = await cookies();
  const expected = jar.get(JOBBER_OAUTH_STATE_COOKIE)?.value ?? "";
  jar.delete(JOBBER_OAUTH_STATE_COOKIE);
  if (!expected || !returnedState) return false;
  const expectedBytes = Buffer.from(expected);
  const returnedBytes = Buffer.from(returnedState);
  return (
    expectedBytes.length === returnedBytes.length &&
    timingSafeEqual(expectedBytes, returnedBytes)
  );
}
