import { unstable_cache } from "next/cache";
import { GOOGLE_REVIEWS_CACHE_SECONDS, isGoogleReviewsConfigured } from "./config";
import { fetchGooglePlaceReviews } from "./google-places";
import type { GoogleReviewsApiResponse } from "./types";

const getCachedGoogleReviews = unstable_cache(
  async () => fetchGooglePlaceReviews(),
  ["squeegeeking-google-reviews"],
  { revalidate: GOOGLE_REVIEWS_CACHE_SECONDS, tags: ["google-reviews"] },
);

export async function getGoogleReviewsResponse(): Promise<GoogleReviewsApiResponse> {
  if (!isGoogleReviewsConfigured()) {
    return {
      status: "unavailable",
      data: {
        totalCount: 0,
        averageRating: 0,
        source: "Google",
        reviews: [],
        attribution: "Google reviews not configured",
      },
      message: "Google reviews are not configured yet.",
    };
  }

  try {
    const data = await getCachedGoogleReviews();
    return {
      status: "live",
      data: {
        ...data,
        isCached: true,
        attribution: "Based on Google reviews.",
      },
      fetchedAt: data.fetchedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google reviews unavailable";

    return {
      status: "unavailable",
      data: {
        totalCount: 0,
        averageRating: 0,
        source: "Google",
        reviews: [],
      },
      message,
    };
  }
}
