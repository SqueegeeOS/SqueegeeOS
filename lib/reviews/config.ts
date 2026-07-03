export const GOOGLE_REVIEWS_CACHE_SECONDS = 8 * 60 * 60; // 8 hours

export function isGoogleReviewsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_MAPS_API_KEY?.trim() &&
      process.env.GOOGLE_PLACE_ID?.trim(),
  );
}

export function getGooglePlaceId(): string | null {
  return process.env.GOOGLE_PLACE_ID?.trim() ?? null;
}

export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? null;
}
