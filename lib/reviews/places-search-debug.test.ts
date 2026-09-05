import { afterEach, describe, expect, it, vi } from "vitest";

import { runPlacesSearchDiagnostic } from "./places-search-debug";

describe("Places search diagnostics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caps every service-area search and explains remaining Google errors", async () => {
    const requests: Array<{ url: string; body?: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        requests.push({ url, body: init?.body?.toString() });

        if (url.includes("places.googleapis.com")) {
          return new Response(
            JSON.stringify({
              error: {
                status: "INVALID_ARGUMENT",
                message: "A request field is invalid.",
              },
            }),
            { status: 400 },
          );
        }

        const resultKey = url.includes("textsearch") ? "results" : "candidates";
        return new Response(
          JSON.stringify({ status: "ZERO_RESULTS", [resultKey]: [] }),
          { status: 200 },
        );
      }),
    );

    const diagnostic = await runPlacesSearchDiagnostic(
      "test-api-key",
      { name: "SqueegeeKing", serviceAreaMode: true },
      {
        apiKeySource: "server_env",
        serverEnvKeyPresent: true,
        wizardKeyPresent: false,
      },
    );

    const newApiBodies = requests
      .filter((request) => request.url.includes("places.googleapis.com"))
      .map((request) => JSON.parse(request.body ?? "{}"));
    expect(newApiBodies.length).toBeGreaterThan(0);
    expect(
      newApiBodies.every(
        (body) =>
          body.locationBias?.circle?.radius === 50_000 &&
          body.includePureServiceAreaBusinesses === true,
      ),
    ).toBe(true);

    const legacyRequests = requests.filter((request) =>
      request.url.includes("maps.googleapis.com"),
    );
    expect(
      legacyRequests.every((request) =>
        decodeURIComponent(request.url).includes("50000"),
      ),
    ).toBe(true);

    expect(diagnostic.notes).toContain(
      "Places API (New) rejected the request as invalid. The search radius is already capped at Google's 50 km limit; review the returned Google error message and request fields before retrying.",
    );
    expect(diagnostic.notes).toContain(
      "Google accepted at least one search, but these queries returned no candidates. Service-area businesses may still be absent from public Places results; Business Profile API access remains the authoritative connection path.",
    );
  });
});
