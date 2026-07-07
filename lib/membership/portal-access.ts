import { randomBytes } from "crypto";

/** Cryptographically random, URL-safe portal token (~256 bits). */
export function generatePortalAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildPortalAccessPath(token: string): string {
  return `/portal/${encodeURIComponent(token)}`;
}

export function buildPortalHomeHealthPath(token: string): string {
  return `${buildPortalAccessPath(token)}/home-health`;
}

/**
 * Absolute portal URL for emails and onboarding.
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://app.squeegeeking.net).
 */
export function buildPortalAccessUrl(
  token: string,
  origin?: string | null,
): string {
  const path = buildPortalAccessPath(token);
  const base = resolveAppOrigin(origin);
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

function resolveAppOrigin(explicit?: string | null): string | null {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return null;
}
