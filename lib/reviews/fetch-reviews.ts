import type { ReviewsData } from "@/lib/reviews/types";

/**
 * Fetch live Google reviews for Squeegeeking.
 *
 * Integration order:
 * 1. Google Business Profile API — own reviews (preferred, requires API access approval)
 * 2. Google Places API Place Details — public rating/review preview (fallback)
 *
 * Until connected, consumers should use `squeegeekingGoogleReviews` from mock-data.
 */
export async function fetchSqueegeekingReviews(): Promise<ReviewsData> {
  // TODO: Google Business Profile API → fallback to Places API Place Details
  throw new Error("Live Google reviews not yet connected");
}
