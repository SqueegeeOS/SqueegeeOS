import type { BusinessConnectOption } from "./business-connect";
import { fetchPlaceRatingSummary } from "./google-places";

interface GbpAccount {
  name?: string;
  accountName?: string;
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

async function fetchGbpJson<T>(
  url: string,
  accessToken: string,
): Promise<T | null> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function listManagedGoogleBusinesses(
  accessToken: string,
  apiKey?: string,
): Promise<{ businesses: BusinessConnectOption[]; error?: string }> {
  const accountsPayload = await fetchGbpJson<{ accounts?: GbpAccount[] }>(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    accessToken,
  );

  if (!accountsPayload?.accounts?.length) {
    return {
      businesses: [],
      error:
        "No Google Business accounts found for this sign-in. Confirm you use the owner Google account.",
    };
  }

  const businesses: BusinessConnectOption[] = [];

  for (const account of accountsPayload.accounts) {
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

    const locationsPayload = await fetchGbpJson<{ locations?: GbpLocation[] }>(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=20`,
      accessToken,
    );

    for (const location of locationsPayload?.locations ?? []) {
      const placeId = location.metadata?.placeId?.trim();
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

  return { businesses };
}
