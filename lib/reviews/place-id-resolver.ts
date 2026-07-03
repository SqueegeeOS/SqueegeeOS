const PLACE_ID_PATTERN = /ChIJ[A-Za-z0-9_-]{10,}/g;
const MAX_REDIRECTS = 12;

export function extractPlaceIdFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const paramMatch =
    trimmed.match(/place_id[=:]["']?(ChIJ[A-Za-z0-9_-]+)/i)?.[1] ??
    trimmed.match(/"placeId"\s*:\s*"(ChIJ[A-Za-z0-9_-]+)"/i)?.[1] ??
    trimmed.match(/"place_id"\s*:\s*"(ChIJ[A-Za-z0-9_-]+)"/i)?.[1];

  if (paramMatch) return paramMatch;

  const matches = [...trimmed.matchAll(PLACE_ID_PATTERN)].map((match) => match[0]);
  const unique = [...new Set(matches)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) {
    const withReviews = unique.find((id) =>
      trimmed.includes(`"place_id":"${id}"`),
    );
    return withReviews ?? unique[0];
  }

  return null;
}

export function isGoogleBusinessUrl(input: string): boolean {
  const value = input.trim().toLowerCase();
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return false;
  }

  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return (
      host === "share.google" ||
      host.endsWith(".share.google") ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "g.page" ||
      host.endsWith(".g.page") ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "maps.google.com" ||
      host === "business.google.com"
    );
  } catch {
    return (
      value.includes("google.com/maps") ||
      value.includes("maps.app.goo.gl") ||
      value.includes("g.page/") ||
      value.includes("share.google/") ||
      value.includes("goo.gl/maps")
    );
  }
}

/** @deprecated Use isGoogleBusinessUrl */
export function isGoogleMapsUrl(input: string): boolean {
  return isGoogleBusinessUrl(input);
}

function extractRedirectTarget(html: string, baseUrl: string): string | null {
  const metaRefresh =
    html.match(
      /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s;>]+)/i,
    )?.[1] ??
    html.match(
      /content=["'][^"']*url=([^"'\s;>]+)["'][^>]+http-equiv=["']refresh["']/i,
    )?.[1];

  if (metaRefresh) {
    try {
      return new URL(metaRefresh, baseUrl).toString();
    } catch {
      return null;
    }
  }

  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)?.[1];

  if (canonical) {
    try {
      const resolved = new URL(canonical, baseUrl).toString();
      if (resolved !== baseUrl && isGoogleBusinessUrl(resolved)) {
        return resolved;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function extractBusinessNameFromMapsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@?]+)/i);
    if (placeMatch?.[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
    }

    const query = parsed.searchParams.get("q");
    if (query) {
      const withoutPlaceId = query.replace(/^place_id:/i, "").trim();
      if (withoutPlaceId && !withoutPlaceId.startsWith("ChIJ")) {
        return withoutPlaceId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function extractBusinessNameFromHtml(html: string): string | null {
  const ogTitle =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    )?.[1];

  if (ogTitle) {
    return ogTitle
      .replace(/\s*[-–|]\s*Google Maps.*$/i, "")
      .replace(/\s*[-–|]\s*Google Search.*$/i, "")
      .trim();
  }

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (title) {
    return title
      .replace(/\s*[-–|]\s*Google Maps.*$/i, "")
      .replace(/\s*[-–|]\s*Google Search.*$/i, "")
      .trim();
  }

  return null;
}

async function followRedirectsToFinalUrl(
  startUrl: string,
): Promise<{ finalUrl: string; html: string | null }> {
  let current = startUrl;
  let html: string | null = null;

  const fetchHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const initial = await fetch(startUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: fetchHeaders,
    });
    current = initial.url || startUrl;
    const initialType = initial.headers.get("content-type") ?? "";
    if (initialType.includes("text/html")) {
      html = await initial.text();
      const redirectTarget = extractRedirectTarget(html, current);
      if (redirectTarget && redirectTarget !== current) {
        current = redirectTarget;
        html = null;
      } else {
        return { finalUrl: current, html };
      }
    } else if (current !== startUrl) {
      return { finalUrl: current, html: null };
    }
  } catch {
    // Fall through to manual redirect handling.
  }

  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        headers: fetchHeaders,
      });
    } catch {
      break;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      try {
        current = new URL(location, current).toString();
        html = null;
        continue;
      } catch {
        break;
      }
    }

    if (!response.ok) {
      break;
    }

    const finalUrl = response.url || current;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/html")) {
      html = await response.text();
      const redirectTarget = extractRedirectTarget(html, finalUrl);
      if (redirectTarget && redirectTarget !== finalUrl) {
        current = redirectTarget;
        html = null;
        continue;
      }
    }

    return { finalUrl, html };
  }

  return { finalUrl: current, html };
}

export interface PlaceSearchCandidate {
  placeId: string;
  name: string;
  /** @deprecated Prefer locationLabel */
  address?: string;
  locationLabel: string;
  isServiceAreaBusiness: boolean;
  rating?: number;
  reviewCount?: number;
  website?: string;
  phone?: string;
}

export interface BusinessSearchInput {
  name?: string;
  phone?: string;
  website?: string;
  serviceAreaMode?: boolean;
}

interface NewPlaceRecord {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  pureServiceAreaBusiness?: boolean;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
}

function componentText(
  component: NonNullable<NewPlaceRecord["addressComponents"]>[number],
): string {
  return (
    component.longText ??
    component.long_name ??
    component.shortText ??
    component.short_name ??
    ""
  );
}

function extractLocalityArea(
  components?: NewPlaceRecord["addressComponents"],
): string | null {
  if (!components?.length) return null;

  const locality = components.find((c) => c.types?.includes("locality"));
  const region = components.find((c) =>
    c.types?.includes("administrative_area_level_1"),
  );

  const city = locality ? componentText(locality) : "";
  const state = region ? componentText(region) : "";

  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}

function isLikelyServiceAreaAddress(address: string): boolean {
  const value = address.toLowerCase();
  return (
    value.includes("service area") ||
    value.includes("serves ") ||
    !/\d/.test(value)
  );
}

function buildLocationLabelFromPlace(
  place: NewPlaceRecord,
  legacyAddress?: string,
): Pick<PlaceSearchCandidate, "locationLabel" | "isServiceAreaBusiness" | "address"> {
  const locality = extractLocalityArea(place.addressComponents);
  const shortAddress =
    place.shortFormattedAddress?.trim() ||
    place.formattedAddress?.trim() ||
    legacyAddress?.trim() ||
    "";

  const isSab =
    place.pureServiceAreaBusiness === true ||
    Boolean(
      shortAddress &&
        (isLikelyServiceAreaAddress(shortAddress) || !place.formattedAddress),
    );

  if (isSab || (shortAddress && isLikelyServiceAreaAddress(shortAddress))) {
    const area = locality ?? shortAddress.replace(/service area/gi, "").trim();
    return {
      isServiceAreaBusiness: true,
      locationLabel: area ? `Service area · ${area}` : "Service area business",
      address: area || undefined,
    };
  }

  return {
    isServiceAreaBusiness: false,
    locationLabel: shortAddress || "Address not listed publicly",
    address: shortAddress || undefined,
  };
}

function mapNewPlaceToCandidate(place: NewPlaceRecord): PlaceSearchCandidate | null {
  const rawId = place.id ?? place.name ?? "";
  const placeId = rawId.startsWith("places/")
    ? rawId.slice("places/".length)
    : rawId;
  if (!placeId) return null;

  const location = buildLocationLabelFromPlace(place);

  return {
    placeId,
    name: place.displayName?.text ?? "Unknown business",
    ...location,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    website: place.websiteUri?.replace(/\/$/, ""),
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
  };
}

function dedupeCandidates(candidates: PlaceSearchCandidate[]): PlaceSearchCandidate[] {
  const byId = new Map<string, PlaceSearchCandidate>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.placeId);
    if (!existing) {
      byId.set(candidate.placeId, candidate);
      continue;
    }
    byId.set(candidate.placeId, {
      ...existing,
      ...candidate,
      locationLabel: candidate.locationLabel || existing.locationLabel,
      isServiceAreaBusiness:
        existing.isServiceAreaBusiness || candidate.isServiceAreaBusiness,
    });
  }
  return [...byId.values()];
}

export function normalizeWebsiteQuery(website: string): string {
  return website
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

export function buildBusinessSearchQueries(input: BusinessSearchInput): string[] {
  const queries: string[] = [];
  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const website = input.website ? normalizeWebsiteQuery(input.website) : "";

  if (phone) queries.push(phone);
  if (website) {
    queries.push(website);
    if (name) queries.push(`${name} ${website}`);
  }
  if (name) {
    queries.push(name);
    if (input.serviceAreaMode) {
      queries.push(`${name} service area business`);
    }
  }

  return [...new Set(queries.filter(Boolean))];
}

export async function searchGooglePlacesMulti(
  apiKey: string,
  input: BusinessSearchInput,
): Promise<PlaceSearchCandidate[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return [];

  let results: PlaceSearchCandidate[] = [];

  const phone = input.phone?.trim();
  if (phone) {
    results = [...results, ...(await searchGooglePlacesByPhone(trimmedKey, phone))];
  }

  for (const query of buildBusinessSearchQueries(input)) {
    results = [
      ...results,
      ...(await searchGooglePlaces(trimmedKey, query, {
        serviceAreaMode: input.serviceAreaMode,
      })),
    ];
  }

  return dedupeCandidates(results).slice(0, 8);
}

export interface ResolveGoogleBusinessResult {
  placeId: string | null;
  resolvedUrl: string;
  businessNameHint: string | null;
  candidates: PlaceSearchCandidate[];
  method: "url" | "search" | "none";
}

export async function resolveGoogleBusinessLink(
  inputUrl: string,
  apiKey?: string,
  searchHints?: Pick<BusinessSearchInput, "phone" | "website">,
): Promise<ResolveGoogleBusinessResult> {
  const trimmed = inputUrl.trim();
  const emptyResult = (
    resolvedUrl: string,
    businessNameHint: string | null = null,
  ): ResolveGoogleBusinessResult => ({
    placeId: null,
    resolvedUrl,
    businessNameHint,
    candidates: [],
    method: "none",
  });

  const direct = extractPlaceIdFromText(trimmed);
  if (direct) {
    return {
      placeId: direct,
      resolvedUrl: trimmed,
      businessNameHint: extractBusinessNameFromMapsUrl(trimmed),
      candidates: [],
      method: "url",
    };
  }

  if (!isGoogleBusinessUrl(trimmed)) {
    return emptyResult(trimmed);
  }

  const { finalUrl, html } = await followRedirectsToFinalUrl(trimmed);

  let placeId = extractPlaceIdFromText(finalUrl);
  if (!placeId && html) {
    placeId = extractPlaceIdFromText(html);
  }

  const businessNameHint =
    extractBusinessNameFromMapsUrl(finalUrl) ??
    (html ? extractBusinessNameFromHtml(html) : null);

  if (placeId) {
    return {
      placeId,
      resolvedUrl: finalUrl,
      businessNameHint,
      candidates: [],
      method: "url",
    };
  }

  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    return {
      ...emptyResult(finalUrl, businessNameHint),
      method: "none",
    };
  }

  const searchResult = await searchGooglePlacesMulti(trimmedKey, {
    name: businessNameHint ?? undefined,
    phone: searchHints?.phone,
    website: searchHints?.website,
    serviceAreaMode: true,
  });

  if (searchResult.length === 1) {
    return {
      placeId: searchResult[0].placeId,
      resolvedUrl: finalUrl,
      businessNameHint,
      candidates: searchResult,
      method: "search",
    };
  }

  if (searchResult.length > 1) {
    return {
      placeId: null,
      resolvedUrl: finalUrl,
      businessNameHint,
      candidates: searchResult,
      method: "search",
    };
  }

  return emptyResult(finalUrl, businessNameHint);
}

/**
 * Follow short Google Maps / Business links and extract Place ID when possible.
 */
export async function resolvePlaceIdFromMapsUrl(
  inputUrl: string,
  apiKey?: string,
): Promise<{ placeId: string | null; resolvedUrl: string }> {
  const result = await resolveGoogleBusinessLink(inputUrl, apiKey);
  return {
    placeId: result.placeId,
    resolvedUrl: result.resolvedUrl,
  };
}

interface NewSearchTextResponse {
  places?: NewPlaceRecord[];
  error?: { message?: string };
}

export interface SearchGooglePlacesOptions {
  serviceAreaMode?: boolean;
}

export async function searchGooglePlaces(
  apiKey: string,
  query: string,
  options?: SearchGooglePlacesOptions,
): Promise<PlaceSearchCandidate[]> {
  const trimmedKey = apiKey.trim();
  const trimmedQuery = query.trim();
  if (!trimmedKey || !trimmedQuery) return [];

  const fromNew = await searchGooglePlacesNew(trimmedKey, trimmedQuery, options);
  if (fromNew.length > 0) return fromNew;

  return searchGooglePlacesLegacy(trimmedKey, trimmedQuery);
}

async function searchGooglePlacesByPhone(
  apiKey: string,
  phone: string,
): Promise<PlaceSearchCandidate[]> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
  );
  url.searchParams.set("input", phone);
  url.searchParams.set("inputtype", "phonenumber");
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,rating,user_ratings_total,types,business_status",
  );
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      status: string;
      candidates?: Array<{
        place_id?: string;
        name?: string;
        formatted_address?: string;
        rating?: number;
        user_ratings_total?: number;
      }>;
    };

    if (payload.status !== "OK" || !payload.candidates?.length) return [];

    return payload.candidates
      .filter((item) => Boolean(item.place_id))
      .map((item) => {
        const location = buildLocationLabelFromPlace(
          { formattedAddress: item.formatted_address },
          item.formatted_address,
        );
        return {
          placeId: item.place_id!,
          name: item.name ?? "Unknown business",
          ...location,
          rating: item.rating,
          reviewCount: item.user_ratings_total,
          phone,
        };
      });
  } catch {
    return [];
  }
}

async function searchGooglePlacesNew(
  apiKey: string,
  query: string,
  _options?: SearchGooglePlacesOptions,
): Promise<PlaceSearchCandidate[]> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.name",
          "places.displayName",
          "places.formattedAddress",
          "places.shortFormattedAddress",
          "places.pureServiceAreaBusiness",
          "places.addressComponents",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.websiteUri",
          "places.rating",
          "places.userRatingCount",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 10,
        languageCode: "en",
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  const payload = (await response.json()) as NewSearchTextResponse;
  if (payload.error || !payload.places?.length) return [];

  return payload.places
    .map((place) => mapNewPlaceToCandidate(place))
    .filter((item): item is PlaceSearchCandidate => item !== null);
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
    .map((item) => {
      const location = buildLocationLabelFromPlace(
        { formattedAddress: item.formatted_address },
        item.formatted_address,
      );
      return {
        placeId: item.place_id!,
        name: item.name ?? "Unknown business",
        ...location,
        rating: item.rating,
        reviewCount: item.user_ratings_total,
      };
    })
    .slice(0, 10);
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
      checks: [{ id: "api-key", label: "API key provided", passed: false }],
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
