import { randomBytes } from "crypto";

const CANONICAL_PUBLIC_ORIGIN = "https://www.squeegeeking.net";

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
 * NEXT_PUBLIC_APP_URL is the preferred source. Vercel deployment URLs are
 * deliberately rejected because preview/deployment protection can turn a
 * customer's private portal link into a Vercel login screen.
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

/** Canonical public origin for provider redirects; never returns a protected Vercel preview. */
export function resolvePublicAppOrigin(origin?: string | null): string {
  return resolveAppOrigin(origin) ?? CANONICAL_PUBLIC_ORIGIN;
}

function resolveAppOrigin(explicit?: string | null): string | null {
  const configured = normalizePublicOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;

  const requestOrigin = normalizePublicOrigin(explicit);
  if (requestOrigin) return requestOrigin;

  return CANONICAL_PUBLIC_ORIGIN;
}

function normalizePublicOrigin(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}
