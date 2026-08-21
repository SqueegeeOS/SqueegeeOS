import "server-only";

import { getGooglePlaceId } from "./config";
import { readGoogleBusinessConnectionStatus } from "./google-business-connection-store";
import {
  googleReviewRequestUrlForPlaceId,
  isSafeGoogleReviewRequestUrl,
} from "./review-request-url";

export async function resolveGoogleReviewRequestUrl(): Promise<string | null> {
  const configured = process.env.GOOGLE_REVIEW_REQUEST_URL?.trim();
  if (configured && isSafeGoogleReviewRequestUrl(configured)) return configured;

  const connectionPlaceId = await readGoogleBusinessConnectionStatus()
    .then((status) => status.placeId)
    .catch(() => null);
  return googleReviewRequestUrlForPlaceId(connectionPlaceId ?? getGooglePlaceId());
}
