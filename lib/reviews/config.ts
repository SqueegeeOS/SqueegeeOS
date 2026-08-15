export const GOOGLE_REVIEWS_CACHE_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * Prefer the owner-authorized Business Profile corpus so the public review
 * wall can show the complete, paginated archive. The provider response is
 * cached for eight hours (well inside Google's 30-day storage ceiling), keeps
 * Google attribution intact, and falls back to the supported five-review
 * Places preview whenever the owner connection or API access is unavailable.
 *
 * Set the environment value explicitly to `false` as an operational kill
 * switch without removing the Google connection.
 */
export function isPublicFullGoogleReviewDisplayEnabled(): boolean {
  return (
    process.env.GOOGLE_BUSINESS_PUBLIC_FULL_REVIEWS_ENABLED
      ?.trim()
      .toLowerCase() !== "false"
  );
}

/**
 * Place IDs are public identifiers. API keys and OAuth tokens are not.
 * Keep a mistaken secret out of review requests, links, and JSON-LD.
 */
export function isLikelyGooglePlaceId(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";

  if (!normalized || normalized.length > 255) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) return false;

  return !(
    normalized.startsWith("AIza") ||
    normalized.startsWith("ya29") ||
    normalized.startsWith("sk_")
  );
}

export function isGoogleReviewsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_MAPS_API_KEY?.trim() &&
      getGooglePlaceId(),
  );
}

export function getGooglePlaceId(): string | null {
  const value = process.env.GOOGLE_PLACE_ID?.trim() ?? null;
  return isLikelyGooglePlaceId(value) ? value : null;
}

export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? null;
}
