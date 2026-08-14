import { normalizeUsPostalCodeInput } from "./postal-code";

export interface AddressSuggestion {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
}

export interface ResolvedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  formattedAddress: string;
}

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface GooglePlaceDetailsResponse {
  formattedAddress?: string;
  postalAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

export function parseAddressSuggestions(
  payload: GoogleAutocompleteResponse,
): AddressSuggestion[] {
  return (payload.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;
      const placeId = prediction?.placeId?.trim() ?? "";
      const label = prediction?.text?.text?.trim() ?? "";
      if (!placeId || !label) return null;

      return {
        placeId,
        label,
        mainText:
          prediction?.structuredFormat?.mainText?.text?.trim() || label,
        secondaryText:
          prediction?.structuredFormat?.secondaryText?.text?.trim() || "",
      };
    })
    .filter((value): value is AddressSuggestion => value !== null)
    .slice(0, 5);
}

function componentValue(
  components: GooglePlaceDetailsResponse["addressComponents"],
  type: string,
  preferShort = false,
): string {
  const component = components?.find((item) => item.types?.includes(type));
  return (
    (preferShort ? component?.shortText : component?.longText) ??
    component?.longText ??
    component?.shortText ??
    ""
  ).trim();
}

export function parseResolvedAddress(
  payload: GooglePlaceDetailsResponse,
): ResolvedAddress | null {
  const components = payload.addressComponents;
  const streetNumber = componentValue(components, "street_number");
  const route = componentValue(components, "route");
  const street =
    payload.postalAddress?.addressLines?.[0]?.trim() ||
    [streetNumber, route].filter(Boolean).join(" ");
  const city =
    payload.postalAddress?.locality?.trim() ||
    componentValue(components, "locality") ||
    componentValue(components, "postal_town") ||
    componentValue(components, "sublocality_level_1");
  const state =
    componentValue(components, "administrative_area_level_1", true) ||
    payload.postalAddress?.administrativeArea?.trim() ||
    "";
  const postalCode =
    payload.postalAddress?.postalCode?.trim() ||
    componentValue(components, "postal_code");
  const postalSuffix = componentValue(components, "postal_code_suffix");
  const zip = normalizeUsPostalCodeInput(
    postalCode && postalSuffix && !postalCode.includes("-")
      ? `${postalCode}-${postalSuffix}`
      : postalCode,
  );

  if (!street) return null;

  return {
    street,
    city,
    state: state.toUpperCase(),
    zip,
    formattedAddress: payload.formattedAddress?.trim() ?? "",
  };
}

export async function fetchAddressSuggestions(
  input: string,
  sessionToken: string,
  apiKey: string,
): Promise<AddressSuggestion[]> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ["us"],
        languageCode: "en-US",
        regionCode: "us",
        locationBias: {
          circle: {
            center: { latitude: 39.7285, longitude: -121.8375 },
            radius: 50_000,
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Google address lookup failed (${response.status})`);
  }

  return parseAddressSuggestions(
    (await response.json()) as GoogleAutocompleteResponse,
  );
}

export async function fetchResolvedAddress(
  placeId: string,
  sessionToken: string,
  apiKey: string,
): Promise<ResolvedAddress | null> {
  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
  );
  url.searchParams.set("languageCode", "en-US");
  url.searchParams.set("regionCode", "us");
  url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "formattedAddress,postalAddress,addressComponents",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Google address details failed (${response.status})`);
  }

  return parseResolvedAddress(
    (await response.json()) as GooglePlaceDetailsResponse,
  );
}
