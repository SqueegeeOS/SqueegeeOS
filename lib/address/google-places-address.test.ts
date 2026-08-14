import { describe, expect, it } from "vitest";
import {
  parseAddressSuggestions,
  parseResolvedAddress,
} from "./google-places-address";

describe("Google Places address helpers", () => {
  it("maps address predictions into a compact picker model", () => {
    expect(
      parseAddressSuggestions({
        suggestions: [
          {
            placePrediction: {
              placeId: "place-1",
              text: { text: "1420 Davis Street, Chico, CA, USA" },
              structuredFormat: {
                mainText: { text: "1420 Davis Street" },
                secondaryText: { text: "Chico, CA, USA" },
              },
            },
          },
        ],
      }),
    ).toEqual([
      {
        placeId: "place-1",
        label: "1420 Davis Street, Chico, CA, USA",
        mainText: "1420 Davis Street",
        secondaryText: "Chico, CA, USA",
      },
    ]);
  });

  it("fills all presentation fields from postal address data", () => {
    expect(
      parseResolvedAddress({
        formattedAddress: "1420 Davis St, Chico, CA 95928, USA",
        postalAddress: {
          addressLines: ["1420 Davis St"],
          locality: "Chico",
          administrativeArea: "CA",
          postalCode: "95928",
        },
      }),
    ).toEqual({
      street: "1420 Davis St",
      city: "Chico",
      state: "CA",
      zip: "95928",
      formattedAddress: "1420 Davis St, Chico, CA 95928, USA",
    });
  });

  it("falls back to components and preserves ZIP+4", () => {
    expect(
      parseResolvedAddress({
        addressComponents: [
          { longText: "77", types: ["street_number"] },
          { longText: "Oak Avenue", types: ["route"] },
          { longText: "Paradise", types: ["locality"] },
          {
            longText: "California",
            shortText: "CA",
            types: ["administrative_area_level_1"],
          },
          { longText: "95969", types: ["postal_code"] },
          { longText: "1234", types: ["postal_code_suffix"] },
        ],
      }),
    ).toMatchObject({
      street: "77 Oak Avenue",
      city: "Paradise",
      state: "CA",
      zip: "95969-1234",
    });
  });
});
