import { afterEach, describe, expect, it, vi } from "vitest";
import {
  candidateMatchesJobberAddress,
  formatJobberServiceAddress,
  geocodeJobberServiceAddress,
  territoryAddressHash,
  type JobberServiceAddress,
} from "./territory-geocoding";

const address: JobberServiceAddress = {
  street1: "123 Main St",
  street2: "Suite 4",
  city: "Chico",
  province: "CA",
  postalCode: "95928",
  country: "US",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private Jobber territory geocoding", () => {
  it("formats and hashes a stable service address", () => {
    const formatted = formatJobberServiceAddress(address);
    expect(formatted).toBe("123 Main St Suite 4, Chico CA 95928, US");
    expect(territoryAddressHash(formatted)).toMatch(/^[a-f0-9]{64}$/);
    expect(territoryAddressHash(`  ${formatted.toUpperCase()}  `)).toBe(
      territoryAddressHash(formatted),
    );
  });

  it("rejects plausible nearby results that do not match the Jobber property", () => {
    expect(
      candidateMatchesJobberAddress(
        address,
        "123 Main Street, Chico, CA 95928, USA",
      ),
    ).toBe(true);
    expect(
      candidateMatchesJobberAddress(
        address,
        "129 Main Street, Chico, CA 95928, USA",
      ),
    ).toBe(false);
    expect(
      candidateMatchesJobberAddress(
        address,
        "123 Main Street, Paradise, CA 95969, USA",
      ),
    ).toBe(false);
  });

  it("returns only a validated Google candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [
              {
                id: "wrong-home",
                formattedAddress: "129 Main St, Chico, CA 95928, USA",
                location: { latitude: 39.72, longitude: -121.83 },
              },
              {
                id: "right-home",
                formattedAddress: "123 Main St, Chico, CA 95928, USA",
                location: { latitude: 39.73, longitude: -121.84 },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      geocodeJobberServiceAddress(address, "private-key"),
    ).resolves.toEqual({
      status: "resolved",
      formattedAddress: "123 Main St, Chico, CA 95928, USA",
      latitude: 39.73,
      longitude: -121.84,
      placeId: "right-home",
    });
    const request = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      locationBias: { circle: { radius: number } };
    };
    expect(body.locationBias.circle.radius).toBe(50_000);
  });
});
