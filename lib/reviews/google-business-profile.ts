import type { BusinessConnectOption } from "./business-connect";
import { GBP_ACCOUNTS_LIST_URL } from "./google-oauth-config";
import {
  fetchOAuthTokenInfo,
  tokenHasBusinessManageScope,
} from "./google-oauth-token-info";
import { fetchPlaceRatingSummary } from "./google-places";
import { logGoogleReviewsSetup } from "./setup-log";

interface GbpAccount {
  name?: string;
  accountName?: string;
  type?: string;
  verificationState?: string;
  vettedState?: string;
}

interface GbpLocation {
  name?: string;
  title?: string;
  websiteUri?: string;
  metadata?: { placeId?: string };
  categories?: {
    primaryCategory?: { displayName?: string };
  };
  serviceArea?: {
    businessType?: string;
    places?: { placeInfos?: Array<{ placeName?: string }> };
  };
  storefrontAddress?: {
    locality?: string;
    administrativeArea?: string;
  };
}

export type GbpFailureKind =
  | "success"
  | "api_access_blocked"
  | "missing_business_manage_scope"
  | "accounts_request_failed"
  | "zero_accounts"
  | "locations_request_failed"
  | "zero_locations"
  | "locations_missing_place_id";

export interface GbpAccountPreview {
  name?: string;
  accountName?: string;
  type?: string;
}

export interface GbpLocationPreview {
  title?: string;
  placeId?: string | null;
  accountName?: string;
}

export interface GbpApiDiagnostic {
  failureKind: GbpFailureKind;
  accountsEndpoint: string;
  locationsEndpoint?: string;
  accountsHttpStatus?: number;
  accountsError?: string;
  accountCount?: number;
  locationCount?: number;
  locationsHttpStatus?: number;
  locationsError?: string;
  needsApiApproval?: boolean;
  oauthScopes?: string;
  hasBusinessManageScope?: boolean;
  accountsRaw?: GbpAccountPreview[];
  locationPreviews?: GbpLocationPreview[];
  accountsResponseSnippet?: string;
  recommendedApis?: readonly string[];
  interpretation: string;
}

export const GBP_API_ACCESS_FORM_URL =
  "https://developers.google.com/my-business/content/prereqs#request-access";

const REQUIRED_APIS = [
  "My Business Account Management API",
  "Business Profile Business Information API",
] as const;

function buildGbpLocationLabel(location: GbpLocation): string {
  if (location.serviceArea && !location.storefrontAddress) {
    const places = location.serviceArea.places?.placeInfos ?? [];
    const names = places
      .map((place) => place.placeName)
      .filter(Boolean)
      .slice(0, 3);
    if (names.length > 0) {
      return `Service area · ${names.join(", ")}`;
    }
    return "Service area business";
  }

  const city = location.storefrontAddress?.locality;
  const region = location.storefrontAddress?.administrativeArea;
  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  return "Verified on Google Business";
}

function parseGoogleApiError(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; status?: string; code?: number };
    };
    return json.error?.message ?? body.slice(0, 500);
  } catch {
    return body.slice(0, 500);
  }
}

function isLikelyApiAccessBlock(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 403 ||
    status === 429 ||
    lower.includes("quota") ||
    lower.includes("not enabled") ||
    lower.includes("access not configured") ||
    lower.includes("permission denied") ||
    lower.includes("has not been used") ||
    lower.includes("disabled")
  );
}

function summarizeAccountsResponse(data: unknown): string {
  try {
    return JSON.stringify(data).slice(0, 800);
  } catch {
    return "";
  }
}

async function fetchGbpJson<T>(
  url: string,
  accessToken: string,
): Promise<{ data: T | null; status: number; error?: string; rawBody?: string }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const body = await response.text();

  if (!response.ok) {
    return {
      data: null,
      status: response.status,
      error: parseGoogleApiError(body),
      rawBody: body.slice(0, 800),
    };
  }

  try {
    return {
      data: JSON.parse(body) as T,
      status: response.status,
      rawBody: body.slice(0, 800),
    };
  } catch {
    return {
      data: null,
      status: response.status,
      error: "Unexpected response from Google Business Profile API.",
      rawBody: body.slice(0, 800),
    };
  }
}

function buildInterpretation(
  failureKind: GbpFailureKind,
  needsApiApproval?: boolean,
): string {
  switch (failureKind) {
    case "success":
      return "Google returned managed locations with Place IDs.";
    case "api_access_blocked":
      return "API / quota issue — not an account mismatch. Request Business Profile Basic API Access for this Cloud project (quota is often 0 QPM until Google approves).";
    case "missing_business_manage_scope":
      return "OAuth token is missing the business.manage scope. Sign out and sign in again, accepting all requested permissions.";
    case "accounts_request_failed":
      return "The accounts API call failed. Confirm My Business Account Management API is enabled on this Cloud project.";
    case "zero_accounts":
      return needsApiApproval
        ? "Accounts API returned empty — likely API access not approved yet, not necessarily the wrong Google account."
        : "Accounts API returned HTTP 200 with zero accounts. This usually means the signed-in Google account does not own/manage any Business Profile linked to this OAuth token. Confirm the same email at business.google.com.";
    case "locations_request_failed":
      return "Accounts were found but location lookup failed — enable Business Profile Business Information API or request Basic API Access.";
    case "zero_locations":
      return "Google accounts exist but no locations were returned. The account may be empty or location API access is blocked.";
    case "locations_missing_place_id":
      return "Locations were returned but none included a Place ID in metadata yet. Retry later or use the share-link fallback.";
    default:
      return "Unknown state.";
  }
}

export async function listManagedGoogleBusinesses(
  accessToken: string,
  apiKey?: string,
  options?: { email?: string | null },
): Promise<{
  businesses: BusinessConnectOption[];
  error?: string;
  diagnostic: GbpApiDiagnostic;
}> {
  const tokenInfo = await fetchOAuthTokenInfo(accessToken);
  const oauthScopes = tokenInfo?.scope;
  const hasBusinessManageScope = tokenHasBusinessManageScope(oauthScopes);

  const diagnostic: GbpApiDiagnostic = {
    failureKind: "accounts_request_failed",
    accountsEndpoint: GBP_ACCOUNTS_LIST_URL,
    oauthScopes,
    hasBusinessManageScope,
    recommendedApis: REQUIRED_APIS,
    interpretation: "",
  };

  if (!hasBusinessManageScope) {
    diagnostic.failureKind = "missing_business_manage_scope";
    diagnostic.interpretation = buildInterpretation(diagnostic.failureKind);
    return {
      businesses: [],
      error:
        "OAuth token is missing business.manage scope. Sign out of Google in the wizard and sign in again.",
      diagnostic,
    };
  }

  const accountsResult = await fetchGbpJson<{ accounts?: GbpAccount[] }>(
    GBP_ACCOUNTS_LIST_URL,
    accessToken,
  );

  diagnostic.accountsHttpStatus = accountsResult.status;
  diagnostic.accountsError = accountsResult.error;

  if (!accountsResult.data) {
    diagnostic.needsApiApproval = isLikelyApiAccessBlock(
      accountsResult.status,
      accountsResult.error ?? "",
    );
    diagnostic.failureKind = diagnostic.needsApiApproval
      ? "api_access_blocked"
      : accountsResult.status === 401
        ? "accounts_request_failed"
        : "accounts_request_failed";
    diagnostic.accountsResponseSnippet =
      accountsResult.rawBody ?? accountsResult.error;
    diagnostic.interpretation = buildInterpretation(
      diagnostic.failureKind,
      diagnostic.needsApiApproval,
    );

    logGoogleReviewsSetup("gbp_accounts_list", {
      email: options?.email ?? tokenInfo?.email ?? null,
      failureKind: diagnostic.failureKind,
      accountsHttpStatus: accountsResult.status,
      accountsError: accountsResult.error ?? null,
      oauthScopes: oauthScopes ?? null,
      accountsRaw: accountsResult.rawBody ?? null,
    });

    return {
      businesses: [],
      error: diagnostic.interpretation,
      diagnostic,
    };
  }

  const accounts = accountsResult.data.accounts ?? [];
  diagnostic.accountCount = accounts.length;
  diagnostic.accountsRaw = accounts.map((account) => ({
    name: account.name,
    accountName: account.accountName,
    type: account.type,
  }));
  diagnostic.accountsResponseSnippet = summarizeAccountsResponse(
    accountsResult.data,
  );

  logGoogleReviewsSetup("gbp_accounts_list", {
    email: options?.email ?? tokenInfo?.email ?? null,
    failureKind:
      accounts.length === 0 ? "zero_accounts" : "success",
    accountsHttpStatus: accountsResult.status,
    accountCount: accounts.length,
    accountsRaw: diagnostic.accountsResponseSnippet,
    oauthScopes: oauthScopes ?? null,
  });

  if (accounts.length === 0) {
    diagnostic.failureKind = "zero_accounts";
    diagnostic.interpretation = buildInterpretation(
      diagnostic.failureKind,
      false,
    );
    return {
      businesses: [],
      error: diagnostic.interpretation,
      diagnostic,
    };
  }

  const businesses: BusinessConnectOption[] = [];
  const locationPreviews: GbpLocationPreview[] = [];
  let totalLocations = 0;
  let locationsFailed = false;

  for (const account of accounts) {
    if (!account.name) continue;

    const readMask = [
      "name",
      "title",
      "metadata",
      "categories",
      "serviceArea",
      "storefrontAddress",
      "websiteUri",
    ].join(",");

    const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=20`;
    diagnostic.locationsEndpoint = locationsUrl;

    const locationsResult = await fetchGbpJson<{ locations?: GbpLocation[] }>(
      locationsUrl,
      accessToken,
    );

    if (!locationsResult.data) {
      locationsFailed = true;
      diagnostic.locationsHttpStatus = locationsResult.status;
      diagnostic.locationsError = locationsResult.error;
      if (
        isLikelyApiAccessBlock(locationsResult.status, locationsResult.error ?? "")
      ) {
        diagnostic.needsApiApproval = true;
      }
      continue;
    }

    const locations = locationsResult.data.locations ?? [];
    totalLocations += locations.length;

    for (const location of locations) {
      const placeId = location.metadata?.placeId?.trim() ?? null;
      locationPreviews.push({
        title: location.title,
        placeId,
        accountName: account.accountName ?? account.name,
      });

      if (!placeId) continue;

      businesses.push({
        placeId,
        name: location.title ?? "Google Business",
        category: location.categories?.primaryCategory?.displayName,
        locationLabel: buildGbpLocationLabel(location),
        isServiceAreaBusiness: Boolean(
          location.serviceArea && !location.storefrontAddress,
        ),
        isVerified: true,
        website: location.websiteUri?.replace(/\/$/, ""),
        source: "google_business",
      });
    }
  }

  diagnostic.locationCount = totalLocations;
  diagnostic.locationPreviews = locationPreviews;

  logGoogleReviewsSetup("gbp_locations_list", {
    email: options?.email ?? tokenInfo?.email ?? null,
    accountCount: accounts.length,
    locationCount: totalLocations,
    locationPreviews: JSON.stringify(locationPreviews),
    businessCount: businesses.length,
    locationsHttpStatus: diagnostic.locationsHttpStatus ?? 200,
    locationsError: diagnostic.locationsError ?? null,
  });

  if (businesses.length > 0) {
    diagnostic.failureKind = "success";
    diagnostic.interpretation = buildInterpretation("success");
  } else if (diagnostic.needsApiApproval || locationsFailed) {
    diagnostic.failureKind = locationsFailed
      ? "locations_request_failed"
      : "api_access_blocked";
    diagnostic.interpretation = buildInterpretation(
      diagnostic.failureKind,
      diagnostic.needsApiApproval,
    );
  } else if (totalLocations === 0) {
    diagnostic.failureKind = "zero_locations";
    diagnostic.interpretation = buildInterpretation("zero_locations");
  } else {
    diagnostic.failureKind = "locations_missing_place_id";
    diagnostic.interpretation = buildInterpretation("locations_missing_place_id");
  }

  if (businesses.length === 0) {
    return {
      businesses: [],
      error: diagnostic.interpretation,
      diagnostic,
    };
  }

  const trimmedKey = apiKey?.trim();
  if (trimmedKey) {
    await Promise.all(
      businesses.map(async (business) => {
        const summary = await fetchPlaceRatingSummary(trimmedKey, business.placeId);
        business.rating = summary.rating;
        business.reviewCount = summary.reviewCount;
      }),
    );
  }

  return { businesses, diagnostic };
}
