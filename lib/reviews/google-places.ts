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
  name?: string;
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
  id?: string;
  displayName?: { text?: string };
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
  businessName?: string,
): ReviewsData {
  return {
    totalCount,
    averageRating: rating,
    source: "Google",
    reviews: reviews.filter((review) => review.reviewText.length > 0),
    isLive: true,
    isCached: false,
    fetchedAt: new Date().toISOString(),
    attribution: businessName
      ? `Based on Google reviews for ${businessName}.`
      : "Based on Google reviews.",
  };
}

export function normalizePlaceId(placeId: string): string {
  const trimmed = placeId.trim();
  if (trimmed.startsWith("places/")) {
    return trimmed.slice("places/".length);
  }
  return trimmed;
}

export async function fetchGooglePlacesNew(
  placeId: string,
  apiKey: string,
): Promise<{ data: ReviewsData; businessName?: string } | null> {
  const normalizedId = normalizePlaceId(placeId);
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedId)}`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,rating,userRatingCount,reviews",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as GoogleNewPlaceResponse;
  if (payload.error) return null;

  const businessName = payload.displayName?.text;
  const data = buildReviewsData(
    payload.rating ?? 0,
    payload.userRatingCount ?? 0,
    (payload.reviews ?? []).map(mapNewReview),
    businessName,
  );

  return { data, businessName };
}

export async function fetchGooglePlacesLegacy(
  placeId: string,
  apiKey: string,
): Promise<{ data: ReviewsData; businessName?: string } | null> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", normalizePlaceId(placeId));
  url.searchParams.set("fields", "name,rating,user_ratings_total,reviews");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) return null;

  const payload = (await response.json()) as GoogleLegacyPlaceResponse;
  if (payload.status !== "OK" || !payload.result) return null;

  const businessName = payload.result.name;
  const data = buildReviewsData(
    payload.result.rating ?? 0,
    payload.result.user_ratings_total ?? 0,
    (payload.result.reviews ?? []).map(mapLegacyReview),
    businessName,
  );

  return { data, businessName };
}

export async function fetchGooglePlaceReviewsWithCredentials(
  apiKey: string,
  placeId: string,
): Promise<{ data: ReviewsData; businessName?: string }> {
  const trimmedKey = apiKey.trim();
  const trimmedPlaceId = normalizePlaceId(placeId);

  if (!trimmedKey || !trimmedPlaceId) {
    throw new Error("API key and Place ID are required");
  }

  const fromNewApi = await fetchGooglePlacesNew(trimmedPlaceId, trimmedKey);
  if (
    fromNewApi &&
    (fromNewApi.data.totalCount > 0 || fromNewApi.data.reviews.length > 0)
  ) {
    return fromNewApi;
  }

  const fromLegacyApi = await fetchGooglePlacesLegacy(trimmedPlaceId, trimmedKey);
  if (fromLegacyApi) return fromLegacyApi;

  throw new Error(
    "Unable to load reviews. Check that Places API is enabled and the Place ID is correct.",
  );
}

export async function fetchPlaceRatingSummary(
  apiKey: string,
  placeId: string,
): Promise<{ rating?: number; reviewCount?: number; businessName?: string }> {
  const trimmedKey = apiKey.trim();
  const trimmedPlaceId = normalizePlaceId(placeId);
  if (!trimmedKey || !trimmedPlaceId) return {};

  try {
    const fromNew = await fetchGooglePlacesNew(trimmedPlaceId, trimmedKey);
    if (fromNew) {
      return {
        rating: fromNew.data.averageRating,
        reviewCount: fromNew.data.totalCount,
        businessName: fromNew.businessName,
      };
    }
  } catch {
    // try legacy
  }

  try {
    const fromLegacy = await fetchGooglePlacesLegacy(trimmedPlaceId, trimmedKey);
    if (fromLegacy) {
      return {
        rating: fromLegacy.data.averageRating,
        reviewCount: fromLegacy.data.totalCount,
        businessName: fromLegacy.businessName,
      };
    }
  } catch {
    return {};
  }

  return {};
}

export async function fetchGooglePlaceReviews(): Promise<ReviewsData> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();

  if (!apiKey || !placeId) {
    throw new Error("Google reviews not configured");
  }

  const result = await fetchGooglePlaceReviewsWithCredentials(apiKey, placeId);
  return result.data;
}
