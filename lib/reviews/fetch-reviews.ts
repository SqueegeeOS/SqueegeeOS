import { getGoogleReviewsResponse } from "./get-google-reviews";
import type { GoogleReviewsApiResponse } from "./types";

/**
 * Server-side entry for Google reviews.
 * Stage 2: upgrade to Google Business Profile API for owned-business management.
 */
export async function fetchSqueegeekingReviews(): Promise<GoogleReviewsApiResponse> {
  return getGoogleReviewsResponse();
}
