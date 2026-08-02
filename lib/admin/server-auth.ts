import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_SESSION_TTL_MS } from "@/lib/admin/config";

export type AdminAccessMode = "pin" | "beta";
export const ADMIN_SESSION_COOKIE_NAME = "squeegeeking-admin-session";

function configuredAdminPin(): string | null {
  return process.env.ADMIN_PIN?.trim() || null;
}

export function isAdminPrivateBetaEnabled(): boolean {
  return process.env.ADMIN_PRIVATE_BETA?.trim().toLowerCase() === "true";
}

export function getAdminAccessMode(): AdminAccessMode | null {
  if (configuredAdminPin()) return "pin";
  if (isAdminPrivateBetaEnabled()) return "beta";
  return null;
}

function adminSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== ADMIN_SESSION_COOKIE_NAME) continue;

    const value = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
}

export function authorizeAdminRequest(
  credentials: Headers | string | null,
): boolean {
  if (typeof credentials === "object" && credentials !== null) {
    if (verifyAdminSessionToken(adminSessionTokenFromHeaders(credentials))) {
      return true;
    }
    return authorizeAdminRequest(credentials.get("x-admin-pin"));
  }

  const configured = configuredAdminPin();

  if (!configured) {
    // Missing configuration must fail closed unless private beta was
    // deliberately enabled. An absent secret is never implicit permission.
    return isAdminPrivateBetaEnabled();
  }

  if (!credentials) return false;

  const actual = Buffer.from(credentials);
  const expected = Buffer.from(configured);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionSignature(expiresAt: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`squeegeeking-admin:${expiresAt}`)
    .digest("base64url");
}

export function issueAdminSessionToken(now = Date.now()): string | null {
  const secret = configuredAdminPin();
  if (!secret) return isAdminPrivateBetaEnabled() ? "private-beta" : null;

  const expiresAt = String(now + ADMIN_SESSION_TTL_MS);
  return `${expiresAt}.${sessionSignature(expiresAt, secret)}`;
}

export function verifyAdminSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  if (isAdminPrivateBetaEnabled() && !configuredAdminPin()) return true;

  const secret = configuredAdminPin();
  if (!secret || !token) return false;

  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra) return false;

  const expiry = Number(expiresAt);
  if (
    !Number.isFinite(expiry) ||
    expiry <= now ||
    expiry > now + ADMIN_SESSION_TTL_MS
  ) {
    return false;
  }

  const expected = Buffer.from(sessionSignature(expiresAt, secret));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
