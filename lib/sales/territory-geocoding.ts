import "server-only";

import { createHash } from "node:crypto";
import { CHICO_SEARCH_BIAS } from "@/lib/reviews/places-search-config";

export interface JobberServiceAddress {
  street1: string;
  street2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface PlacesTextCandidate {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export interface TerritoryGeocodeResult {
  status: "resolved" | "not_found" | "error";
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

export function formatJobberServiceAddress(
  address: JobberServiceAddress,
): string {
  const street = [address.street1, address.street2]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const region = [address.city, address.province, address.postalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return [street, region, address.country?.trim()]
    .filter(Boolean)
    .join(", ");
}

export function territoryAddressHash(address: string): string {
  return createHash("sha256")
    .update(address.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex");
}

function normalizeAddressPart(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function candidateMatchesJobberAddress(
  address: JobberServiceAddress,
  candidate: string,
): boolean {
  const normalizedCandidate = normalizeAddressPart(candidate);
  if (!normalizedCandidate) return false;

  const streetNumber = address.street1.trim().match(/^(\d+[a-z]?)(?:\s|$)/i)?.[1];
  if (
    streetNumber &&
    !new RegExp(`(?:^|\\s)${streetNumber.toLowerCase()}(?:\\s|$)`).test(
      normalizedCandidate,
    )
  ) {
    return false;
  }

  const postalCode = normalizeAddressPart(address.postalCode);
  if (postalCode && !normalizedCandidate.includes(postalCode)) return false;

  const city = normalizeAddressPart(address.city);
  if (city && !normalizedCandidate.includes(city)) return false;

  return Boolean(streetNumber || postalCode) && address.street1.trim().length >= 3;
}

export async function geocodeJobberServiceAddress(
  address: JobberServiceAddress,
  apiKey: string,
): Promise<TerritoryGeocodeResult> {
  const query = formatJobberServiceAddress(address);
  if (!query || !apiKey.trim()) {
    return {
      status: "error",
      formattedAddress: null,
      latitude: null,
      longitude: null,
      placeId: null,
    };
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey.trim(),
          "X-Goog-FieldMask":
            "places.id,places.formattedAddress,places.location",
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 5,
          languageCode: "en",
          regionCode: "US",
          locationBias: {
            circle: {
              center: {
                latitude: CHICO_SEARCH_BIAS.latitude,
                longitude: CHICO_SEARCH_BIAS.longitude,
              },
              // Places Text Search (New) rejects a circular location bias over
              // 50 km. The query already contains the full Jobber address, so
              // the maximum supported bias is wide enough without weakening
              // the exact-address validation below.
              radius: Math.min(50_000, CHICO_SEARCH_BIAS.radiusMeters),
            },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      return {
        status: "error",
        formattedAddress: null,
        latitude: null,
        longitude: null,
        placeId: null,
      };
    }

    const payload = (await response.json()) as {
      places?: PlacesTextCandidate[];
    };
    const match = (payload.places ?? []).find((candidate) => {
      const latitude = candidate.location?.latitude;
      const longitude = candidate.location?.longitude;
      return (
        typeof latitude === "number" &&
        typeof longitude === "number" &&
        candidateMatchesJobberAddress(
          address,
          candidate.formattedAddress ?? "",
        )
      );
    });

    if (!match?.location || !match.formattedAddress) {
      return {
        status: "not_found",
        formattedAddress: null,
        latitude: null,
        longitude: null,
        placeId: null,
      };
    }

    return {
      status: "resolved",
      formattedAddress: match.formattedAddress,
      latitude: match.location.latitude!,
      longitude: match.location.longitude!,
      placeId: match.id ?? null,
    };
  } catch {
    return {
      status: "error",
      formattedAddress: null,
      latitude: null,
      longitude: null,
      placeId: null,
    };
  }
}
