import { unstable_cache } from "next/cache";
import { approvedClientTestimonials } from "./approved-testimonials";
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
      status: "fallback",
      data: approvedClientTestimonials,
      message: "Google reviews not configured — showing approved testimonials.",
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
      data: approvedClientTestimonials,
      message,
    };
  }
}
