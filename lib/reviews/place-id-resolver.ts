const PLACE_ID_PATTERN = /(ChIJ[A-Za-z0-9_-]{10,})/;

export function extractPlaceIdFromText(text: string): string | null {
  const match = text.trim().match(PLACE_ID_PATTERN);
  return match ? match[1] : null;
}

export function isGoogleMapsUrl(input: string): boolean {
  const value = input.trim().toLowerCase();
  return (
    value.includes("google.com/maps") ||
    value.includes("maps.app.goo.gl") ||
    value.includes("g.page/") ||
    value.includes("goo.gl/maps") ||
    value.startsWith("https://maps.app.goo.gl") ||
    value.startsWith("http://maps.google.com")
  );
}

/**
 * Follow short Google Maps links and extract Place ID from the final URL.
 */
export async function resolvePlaceIdFromMapsUrl(
  inputUrl: string,
): Promise<{ placeId: string | null; resolvedUrl: string }> {
  const trimmed = inputUrl.trim();
  let resolvedUrl = trimmed;

  const direct = extractPlaceIdFromText(trimmed);
  if (direct) {
    return { placeId: direct, resolvedUrl: trimmed };
  }

  if (!isGoogleMapsUrl(trimmed)) {
    return { placeId: null, resolvedUrl: trimmed };
  }

  try {
    const response = await fetch(trimmed, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SqueegeeKingSetup/1.0; +https://squeegeeking.com)",
      },
    });
    resolvedUrl = response.url;
  } catch {
    return { placeId: null, resolvedUrl: trimmed };
  }

  const fromResolved = extractPlaceIdFromText(resolvedUrl);
  return { placeId: fromResolved, resolvedUrl };
}

export interface PlaceSearchCandidate {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
}

interface LegacyFindPlaceResponse {
  status: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
  }>;
  error_message?: string;
}

interface NewSearchTextResponse {
  places?: Array<{
    id?: string;
    name?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  }>;
  error?: { message?: string };
}

export async function searchGooglePlaces(
  apiKey: string,
  query: string,
): Promise<PlaceSearchCandidate[]> {
  const trimmedKey = apiKey.trim();
  const trimmedQuery = query.trim();
  if (!trimmedKey || !trimmedQuery) return [];

  const fromNew = await searchGooglePlacesNew(trimmedKey, trimmedQuery);
  if (fromNew.length > 0) return fromNew;

  return searchGooglePlacesLegacy(trimmedKey, trimmedQuery);
}

async function searchGooglePlacesNew(
  apiKey: string,
  query: string,
): Promise<PlaceSearchCandidate[]> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.name,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: query }),
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  const payload = (await response.json()) as NewSearchTextResponse;
  if (payload.error || !payload.places?.length) return [];

  return payload.places
    .map((place): PlaceSearchCandidate | null => {
      const rawId = place.id ?? place.name ?? "";
      const placeId = rawId.startsWith("places/")
        ? rawId.slice("places/".length)
        : rawId;
      if (!placeId) return null;
      return {
        placeId,
        name: place.displayName?.text ?? "Unknown business",
        address: place.formattedAddress,
        rating: place.rating,
        reviewCount: place.userRatingCount,
      };
    })
    .filter((item): item is PlaceSearchCandidate => item !== null)
    .slice(0, 5);
}

async function searchGooglePlacesLegacy(
  apiKey: string,
  query: string,
): Promise<PlaceSearchCandidate[]> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    status: string;
    results?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
    }>;
  };

  if (payload.status !== "OK" || !payload.results?.length) return [];

  return payload.results
    .filter((item) => Boolean(item.place_id))
    .map((item) => ({
      placeId: item.place_id!,
      name: item.name ?? "Unknown business",
      address: item.formatted_address,
      rating: item.rating,
      reviewCount: item.user_ratings_total,
    }))
    .slice(0, 5);
}

export interface GoogleReviewsTestResult {
  apiKeyValid: boolean;
  placeIdValid: boolean;
  reviewsFound: boolean;
  rating: number | null;
  reviewCount: number | null;
  previewReviewCount: number;
  businessName: string | null;
  checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  error: string | null;
}

export async function testGoogleReviewsConnection(
  apiKey: string,
  placeId: string,
): Promise<GoogleReviewsTestResult> {
  const checks: GoogleReviewsTestResult["checks"] = [];
  const trimmedKey = apiKey.trim();
  const trimmedPlaceId = placeId.trim();

  if (!trimmedKey) {
    return {
      apiKeyValid: false,
      placeIdValid: false,
      reviewsFound: false,
      rating: null,
      reviewCount: null,
      previewReviewCount: 0,
      businessName: null,
      checks: [
        { id: "api-key", label: "API key provided", passed: false },
      ],
      error: "Enter your Google Maps API key.",
    };
  }

  checks.push({ id: "api-key", label: "API key provided", passed: true });

  if (!trimmedPlaceId) {
    return {
      apiKeyValid: true,
      placeIdValid: false,
      reviewsFound: false,
      rating: null,
      reviewCount: null,
      previewReviewCount: 0,
      businessName: null,
      checks: [
        ...checks,
        { id: "place-id", label: "Place ID provided", passed: false },
      ],
      error: "Enter or find your Google Place ID.",
    };
  }

  checks.push({ id: "place-id", label: "Place ID provided", passed: true });

  try {
    const { fetchGooglePlaceReviewsWithCredentials } = await import(
      "./google-places"
    );
    const result = await fetchGooglePlaceReviewsWithCredentials(
      trimmedKey,
      trimmedPlaceId,
    );

    checks.push({
      id: "api-works",
      label: "API key works",
      passed: true,
      detail: "Google accepted your API key.",
    });
    checks.push({
      id: "place-works",
      label: "Place ID works",
      passed: true,
      detail: result.businessName ?? "Business found on Google.",
    });

    const reviewsFound =
      result.data.totalCount > 0 || result.data.reviews.length > 0;

    checks.push({
      id: "reviews",
      label: "Reviews found",
      passed: reviewsFound,
      detail: reviewsFound
        ? `${result.data.totalCount} total reviews on Google`
        : "Business found but no reviews returned yet.",
    });

    return {
      apiKeyValid: true,
      placeIdValid: true,
      reviewsFound,
      rating: result.data.averageRating,
      reviewCount: result.data.totalCount,
      previewReviewCount: result.data.reviews.length,
      businessName: result.businessName ?? null,
      checks,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection test failed";

    checks.push({
      id: "api-works",
      label: "API key works",
      passed: false,
      detail: message,
    });
    checks.push({
      id: "place-works",
      label: "Place ID works",
      passed: false,
    });
    checks.push({
      id: "reviews",
      label: "Reviews found",
      passed: false,
    });

    return {
      apiKeyValid: false,
      placeIdValid: false,
      reviewsFound: false,
      rating: null,
      reviewCount: null,
      previewReviewCount: 0,
      businessName: null,
      checks,
      error: message,
    };
  }
}
