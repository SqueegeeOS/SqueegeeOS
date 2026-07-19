import { afterEach, describe, expect, it, vi } from "vitest";

import { searchGooglePlaces } from "./place-id-resolver";

describe("Google Places fallback requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses bounded request shapes and includes pure service-area businesses", async () => {
    const requests: Array<{ url: string; body?: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        requests.push({ url, body: init?.body?.toString() });

        if (url.includes("places.googleapis.com")) {
          return new Response(JSON.stringify({ places: [] }), { status: 200 });
        }

        const resultKey = url.includes("textsearch") ? "results" : "candidates";
        return new Response(
          JSON.stringify({ status: "ZERO_RESULTS", [resultKey]: [] }),
          { status: 200 },
        );
      }),
    );

    await searchGooglePlaces("test-api-key", "SqueegeeKing", {
      serviceAreaMode: true,
    });

    const newApiRequest = requests.find((request) =>
      request.url.includes("places.googleapis.com"),
    );
    const newApiBody = JSON.parse(newApiRequest?.body ?? "{}");
    expect(newApiBody.locationBias.circle.radius).toBe(50_000);
    expect(newApiBody.includePureServiceAreaBusinesses).toBe(true);

    const legacyRequest = requests.find((request) =>
      request.url.includes("textsearch"),
    );
    expect(new URL(legacyRequest!.url).searchParams.get("radius")).toBe("50000");

    const findPlaceRequest = requests.find((request) =>
      request.url.includes("findplacefromtext"),
    );
    expect(
      new URL(findPlaceRequest!.url).searchParams.get("locationbias"),
    ).toContain("circle:50000@");
  });
});
