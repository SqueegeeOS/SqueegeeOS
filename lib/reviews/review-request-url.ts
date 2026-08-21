import { isLikelyGooglePlaceId } from "./config";

export function isSafeGoogleReviewRequestUrl(
  value: string | null | undefined,
): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "g.page" ||
        host === "maps.app.goo.gl")
    );
  } catch {
    return false;
  }
}

export function googleReviewRequestUrlForPlaceId(
  placeId: string | null | undefined,
): string | null {
  if (!isLikelyGooglePlaceId(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    placeId!.trim(),
  )}`;
}
