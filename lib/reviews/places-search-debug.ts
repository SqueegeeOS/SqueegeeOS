import type { BusinessSearchInput } from "./place-id-resolver";
import {
  buildBusinessSearchQueries,
  mapNewPlaceToCandidate,
  type PlaceSearchCandidate,
  type NewPlaceRecord,
} from "./place-id-resolver";
import {
  CHICO_SEARCH_BIAS,
  getPlacesSearchRadiusMeters,
} from "./places-search-config";

export type PlacesSearchApiKind =
  | "places_new"
  | "places_legacy"
  | "find_place_text"
  | "find_place_phone";

export interface DiagnosticCandidate {
  placeId: string;
  name: string;
  rating?: number;
  reviewCount?: number;
  website?: string;
  phone?: string;
  locationLabel?: string;
  isServiceAreaBusiness?: boolean;
}

export interface PlacesSearchAttempt {
  api: PlacesSearchApiKind;
  query: string;
  httpStatus: number;
  googleStatus?: string;
  errorMessage?: string;
  rawCandidateCount: number;
  candidates: DiagnosticCandidate[];
  requestSummary?: string;
}

export interface PlacesSearchDiagnostic {
  queriesAttempted: string[];
  apiKeySource: "wizard" | "server_env" | "none";
  serverEnvKeyPresent: boolean;
  wizardKeyPresent: boolean;
  apiKeyMasked: string | null;
  attempts: PlacesSearchAttempt[];
  mergedCandidateCount: number;
  mergedCandidates: DiagnosticCandidate[];
  notes: string[];
}

function maskApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return "****";
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

function toDiagnosticCandidate(
  candidate: PlaceSearchCandidate,
): DiagnosticCandidate {
  return {
    placeId: candidate.placeId,
    name: candidate.name,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    website: candidate.website,
    phone: candidate.phone,
    locationLabel: candidate.locationLabel,
    isServiceAreaBusiness: candidate.isServiceAreaBusiness,
  };
}

export async function runPlacesSearchDiagnostic(
  apiKey: string,
  input: BusinessSearchInput,
  meta: {
    apiKeySource: "wizard" | "server_env" | "none";
    serverEnvKeyPresent: boolean;
    wizardKeyPresent: boolean;
  },
): Promise<PlacesSearchDiagnostic> {
  const queries = buildBusinessSearchQueries(input);
  const attempts: PlacesSearchAttempt[] = [];
  const notes: string[] = [];
  const merged = new Map<string, PlaceSearchCandidate>();

  if (!apiKey.trim()) {
    notes.push(
      "No API key available. Enter a key in wizard step 4 or set GOOGLE_MAPS_API_KEY on the server.",
    );
    return {
      queriesAttempted: queries,
      apiKeySource: meta.apiKeySource,
      serverEnvKeyPresent: meta.serverEnvKeyPresent,
      wizardKeyPresent: meta.wizardKeyPresent,
      apiKeyMasked: null,
      attempts,
      mergedCandidateCount: 0,
      mergedCandidates: [],
      notes,
    };
  }

  if (input.phone?.trim()) {
    attempts.push(await debugFindPlacePhone(apiKey, input.phone.trim()));
  }

  for (const query of queries) {
    attempts.push(await debugPlacesNew(apiKey, query, input.serviceAreaMode));
    attempts.push(await debugPlacesLegacy(apiKey, query, input.serviceAreaMode));
    attempts.push(await debugFindPlaceText(apiKey, query, input.serviceAreaMode));
  }

  for (const attempt of attempts) {
    for (const candidate of attempt.candidates) {
      if (!merged.has(candidate.placeId)) {
        merged.set(candidate.placeId, {
          placeId: candidate.placeId,
          name: candidate.name,
          locationLabel: candidate.locationLabel ?? "",
          isServiceAreaBusiness: candidate.isServiceAreaBusiness ?? false,
          rating: candidate.rating,
          reviewCount: candidate.reviewCount,
          website: candidate.website,
          phone: candidate.phone,
        });
      }
    }
  }

  const onlyErrors = attempts.every(
    (attempt) => attempt.rawCandidateCount === 0 && Boolean(attempt.errorMessage),
  );
  if (onlyErrors) {
    notes.push(
      "Every Google API call returned zero candidates. Common causes: Places API not enabled, billing not linked, API key restrictions blocking server IP/domain, or missing location context for service-area businesses.",
    );
  }

  const newApiDenied = attempts.some(
    (attempt) =>
      attempt.api === "places_new" &&
      (attempt.httpStatus === 403 ||
        attempt.errorMessage?.includes("PERMISSION_DENIED")),
  );
  if (newApiDenied) {
    notes.push(
      "Places API (New) denied this key. Enable “Places API (New)” in Google Cloud and ensure the key is allowed to call places.googleapis.com.",
    );
  }

  const newApiInvalidArgument = attempts.some(
    (attempt) =>
      attempt.api === "places_new" &&
      (attempt.httpStatus === 400 ||
        attempt.googleStatus === "INVALID_ARGUMENT"),
  );
  if (newApiInvalidArgument) {
    notes.push(
      "Places API (New) rejected the request as invalid. The search radius is already capped at Google's 50 km limit; review the returned Google error message and request fields before retrying.",
    );
  }

  if (attempts.length > 0 && merged.size === 0 && !onlyErrors) {
    notes.push(
      "Google accepted at least one search, but these queries returned no candidates. Service-area businesses may still be absent from public Places results; Business Profile API access remains the authoritative connection path.",
    );
  }

  return {
    queriesAttempted: queries,
    apiKeySource: meta.apiKeySource,
    serverEnvKeyPresent: meta.serverEnvKeyPresent,
    wizardKeyPresent: meta.wizardKeyPresent,
    apiKeyMasked: maskApiKey(apiKey),
    attempts,
    mergedCandidateCount: merged.size,
    mergedCandidates: [...merged.values()].map(toDiagnosticCandidate),
    notes,
  };
}

function buildNewSearchBody(query: string, serviceAreaMode?: boolean) {
  return {
    textQuery: query,
    pageSize: 10,
    languageCode: "en",
    regionCode: "US",
    ...(serviceAreaMode ? { includePureServiceAreaBusinesses: true } : {}),
    locationBias: {
      circle: {
        center: {
          latitude: CHICO_SEARCH_BIAS.latitude,
          longitude: CHICO_SEARCH_BIAS.longitude,
        },
        radius: getPlacesSearchRadiusMeters(serviceAreaMode),
      },
    },
  };
}

async function debugPlacesNew(
  apiKey: string,
  query: string,
  serviceAreaMode?: boolean,
): Promise<PlacesSearchAttempt> {
  const body = buildNewSearchBody(query, serviceAreaMode);
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
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
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const rawText = await response.text();
  let payload: { places?: NewPlaceRecord[]; error?: { message?: string; status?: string } } =
    {};
  try {
    payload = JSON.parse(rawText) as typeof payload;
  } catch {
    payload = { error: { message: rawText.slice(0, 500) } };
  }

  const candidates =
    payload.places
      ?.map((place) => mapNewPlaceToCandidate(place))
      .filter((item): item is PlaceSearchCandidate => item !== null)
      .map(toDiagnosticCandidate) ?? [];

  return {
    api: "places_new",
    query,
    httpStatus: response.status,
    googleStatus: payload.error?.status,
    errorMessage: payload.error?.message,
    rawCandidateCount: candidates.length,
    candidates,
    requestSummary: `searchText ${JSON.stringify(body)}`,
  };
}

async function debugPlacesLegacy(
  apiKey: string,
  query: string,
  serviceAreaMode?: boolean,
): Promise<PlacesSearchAttempt> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set(
    "location",
    `${CHICO_SEARCH_BIAS.latitude},${CHICO_SEARCH_BIAS.longitude}`,
  );
  url.searchParams.set(
    "radius",
    String(
      getPlacesSearchRadiusMeters(serviceAreaMode),
    ),
  );

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = (await response.json()) as {
    status: string;
    error_message?: string;
    results?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
    }>;
  };

  const candidates =
    payload.results
      ?.filter((item) => Boolean(item.place_id))
      .map((item) => ({
        placeId: item.place_id!,
        name: item.name ?? "Unknown business",
        rating: item.rating,
        reviewCount: item.user_ratings_total,
        locationLabel: item.formatted_address,
      })) ?? [];

  return {
    api: "places_legacy",
    query,
    httpStatus: response.status,
    googleStatus: payload.status,
    errorMessage: payload.error_message,
    rawCandidateCount: candidates.length,
    candidates,
    requestSummary: url.toString().replace(apiKey, "API_KEY"),
  };
}

async function debugFindPlaceText(
  apiKey: string,
  query: string,
  serviceAreaMode?: boolean,
): Promise<PlacesSearchAttempt> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
  );
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,rating,user_ratings_total,business_status,types",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set(
    "locationbias",
    `circle:${getPlacesSearchRadiusMeters(serviceAreaMode)}@${CHICO_SEARCH_BIAS.latitude},${CHICO_SEARCH_BIAS.longitude}`,
  );

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = (await response.json()) as {
    status: string;
    error_message?: string;
    candidates?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
    }>;
  };

  const candidates =
    payload.candidates
      ?.filter((item) => Boolean(item.place_id))
      .map((item) => ({
        placeId: item.place_id!,
        name: item.name ?? "Unknown business",
        rating: item.rating,
        reviewCount: item.user_ratings_total,
        locationLabel: item.formatted_address,
      })) ?? [];

  return {
    api: "find_place_text",
    query,
    httpStatus: response.status,
    googleStatus: payload.status,
    errorMessage: payload.error_message,
    rawCandidateCount: candidates.length,
    candidates,
    requestSummary: url.toString().replace(apiKey, "API_KEY"),
  };
}

async function debugFindPlacePhone(
  apiKey: string,
  phone: string,
): Promise<PlacesSearchAttempt> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
  );
  url.searchParams.set("input", phone);
  url.searchParams.set("inputtype", "phonenumber");
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,rating,user_ratings_total",
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = (await response.json()) as {
    status: string;
    error_message?: string;
    candidates?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
    }>;
  };

  const candidates =
    payload.candidates
      ?.filter((item) => Boolean(item.place_id))
      .map((item) => ({
        placeId: item.place_id!,
        name: item.name ?? "Unknown business",
        rating: item.rating,
        reviewCount: item.user_ratings_total,
        locationLabel: item.formatted_address,
        phone,
      })) ?? [];

  return {
    api: "find_place_phone",
    query: phone,
    httpStatus: response.status,
    googleStatus: payload.status,
    errorMessage: payload.error_message,
    rawCandidateCount: candidates.length,
    candidates,
    requestSummary: "findplacefromtext phonenumber",
  };
}
