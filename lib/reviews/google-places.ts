import { GOOGLE_REVIEWS_CACHE_SECONDS } from "./config";
import type { Review, ReviewsData } from "./types";

/** Legacy Places Details — review object */
interface GoogleLegacyReview {
  author_name?: string;
  profile_photo_url?: string;
  rating?: number;
  relative_time_description?: string;
  text?: string;
  time?: number;
}

interface GoogleLegacyPlaceResult {
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleLegacyReview[];
}

interface GoogleLegacyPlaceResponse {
  status: string;
  result?: GoogleLegacyPlaceResult;
  error_message?: string;
}

/** Places API (New) — review object */
interface GoogleNewReview {
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: { text?: string };
  authorAttribution?: {
    displayName?: string;
    photoUri?: string;
  };
}

interface GoogleNewPlaceResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleNewReview[];
  error?: { message?: string };
}

function mapLegacyReview(review: GoogleLegacyReview, index: number): Review {
  const timestamp = review.time
    ? new Date(review.time * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: `google-legacy-${review.time ?? index}`,
    reviewerName: review.author_name?.trim() || "Google Reviewer",
    rating: Math.min(5, Math.max(1, Math.round(review.rating ?? 5))),
    reviewText: review.text?.trim() || "",
    reviewDate: timestamp,
    relativeDate: review.relative_time_description,
    profilePhotoUrl: review.profile_photo_url,
    source: "Google",
  };
}

function mapNewReview(review: GoogleNewReview, index: number): Review {
  return {
    id: `google-new-${review.publishTime ?? index}`,
    reviewerName:
      review.authorAttribution?.displayName?.trim() || "Google Reviewer",
    rating: Math.min(5, Math.max(1, Math.round(review.rating ?? 5))),
    reviewText: review.text?.text?.trim() || "",
    reviewDate: review.publishTime ?? new Date().toISOString(),
    relativeDate: review.relativePublishTimeDescription,
    profilePhotoUrl: review.authorAttribution?.photoUri,
    source: "Google",
  };
}

function buildReviewsData(
  rating: number,
  totalCount: number,
  reviews: Review[],
  fetchedAt: string,
): ReviewsData {
  return {
    totalCount,
    averageRating: rating,
    source: "Google",
    reviews: reviews.filter((review) => review.reviewText.length > 0),
    isLive: true,
    isCached: false,
    fetchedAt,
    attribution: "Based on Google reviews.",
  };
}

async function fetchGooglePlacesNew(
  placeId: string,
  apiKey: string,
): Promise<ReviewsData | null> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews",
      },
      next: { revalidate: GOOGLE_REVIEWS_CACHE_SECONDS },
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as GoogleNewPlaceResponse;
  if (payload.error) return null;

  const fetchedAt = new Date().toISOString();
  return buildReviewsData(
    payload.rating ?? 0,
    payload.userRatingCount ?? 0,
    (payload.reviews ?? []).map(mapNewReview),
    fetchedAt,
  );
}

async function fetchGooglePlacesLegacy(
  placeId: string,
  apiKey: string,
): Promise<ReviewsData | null> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "rating,user_ratings_total,reviews");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    next: { revalidate: GOOGLE_REVIEWS_CACHE_SECONDS },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as GoogleLegacyPlaceResponse;
  if (payload.status !== "OK" || !payload.result) return null;

  const fetchedAt = new Date().toISOString();
  return buildReviewsData(
    payload.result.rating ?? 0,
    payload.result.user_ratings_total ?? 0,
    (payload.result.reviews ?? []).map(mapLegacyReview),
    fetchedAt,
  );
}

export async function fetchGooglePlaceReviews(): Promise<ReviewsData> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();

  if (!apiKey || !placeId) {
    throw new Error("Google reviews not configured");
  }

  const fromNewApi = await fetchGooglePlacesNew(placeId, apiKey);
  if (fromNewApi && (fromNewApi.totalCount > 0 || fromNewApi.reviews.length > 0)) {
    return fromNewApi;
  }

  const fromLegacyApi = await fetchGooglePlacesLegacy(placeId, apiKey);
  if (fromLegacyApi) return fromLegacyApi;

  throw new Error("Unable to load Google reviews");
}
