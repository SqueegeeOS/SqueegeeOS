import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JOBBER_CLIENT_PROPERTIES_QUERY,
  JOBBER_CLIENT_SEARCH_QUERY,
  listJobberClientProperties,
  listJobberClientPropertiesPage,
  proveJobberClientPropertyOwnership,
  searchJobberClients,
} from "./jobber-client-search-provider";

const observedVersioning = JSON.parse(
  readFileSync(
    new URL("./fixtures/jobber-versioning-observed.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;
const warningVersioning = JSON.parse(
  readFileSync(
    new URL("./fixtures/jobber-versioning-warning.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

function client(id: number, name = `Client ${id}`) {
  return {
    id: `client-${id}`,
    name,
    jobberWebUri: `https://secure.getjobber.com/clients/${id}`,
  };
}

function clientResponse(
  nodes: unknown[],
  options: {
    endCursor?: string | null;
    hasNextPage?: boolean;
    errors?: unknown;
    extensions?: Record<string, unknown>;
    headers?: HeadersInit;
    status?: number;
  } = {},
) {
  return new Response(
    JSON.stringify({
      data: {
        clients: {
          nodes,
          pageInfo: {
            endCursor: options.endCursor ?? null,
            hasNextPage: options.hasNextPage ?? false,
          },
        },
      },
      errors: options.errors,
      extensions: options.extensions ?? observedVersioning,
    }),
    { status: options.status ?? 200, headers: options.headers },
  );
}

function propertyResponse(
  nodes: unknown[],
  options: {
    endCursor?: string | null;
    hasNextPage?: boolean;
    extensions?: Record<string, unknown>;
  } = {},
) {
  return new Response(
    JSON.stringify({
      data: {
        client: {
          clientProperties: {
            nodes,
            pageInfo: {
              endCursor: options.endCursor ?? null,
              hasNextPage: options.hasNextPage ?? false,
            },
          },
        },
      },
      extensions: options.extensions ?? observedVersioning,
    }),
  );
}

describe("Jobber member-search provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns one bounded client page with continuation and stays read-only", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      clientResponse(
        [client(100, "Target household"), client(100, "Target household")],
        { endCursor: "cursor-2", hasNextPage: true },
      ),
    );

    const result = await searchJobberClients("access-token", "target", {
      fetcher,
      after: "cursor-1",
    });
    expect(result.clients).toEqual([client(100, "Target household")]);
    expect(result).toMatchObject({
      endCursor: "cursor-2",
      hasNextPage: true,
      clientsScanned: 1,
      pagesScanned: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JOBBER_CLIENT_SEARCH_QUERY).toContain(
      "clients(first: 100, after: $after)",
    );
    expect(JOBBER_CLIENT_SEARCH_QUERY).not.toMatch(/\bmutation\b/i);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.getjobber.com/api/graphql");
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(init.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "X-JOBBER-GRAPHQL-VERSION": "2025-04-16",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      variables: { after: "cursor-1" },
    });
  });

  it("normalizes Unicode, case, surrounding space, and repeated whitespace", async () => {
    const result = await searchJobberClients("token", "  CAFE\u0301   HOME ", {
      fetcher: vi
        .fn()
        .mockResolvedValue(clientResponse([client(1, "Café Home")])),
    });
    expect(result.clients).toHaveLength(1);
  });

  it.each(["a", "x".repeat(101)])(
    "rejects out-of-bounds search input without a request",
    async (query) => {
      const fetcher = vi.fn();
      await expect(
        searchJobberClients("token", query, { fetcher }),
      ).rejects.toMatchObject({ code: "invalid_query" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("returns every matching client from the bounded page", async () => {
    const result = await searchJobberClients("token", "member", {
      fetcher: vi.fn().mockResolvedValue(
        clientResponse(
          Array.from({ length: 21 }, (_, index) =>
            client(index, `Member ${index}`),
          ),
        ),
      ),
    });
    expect(result.clients).toHaveLength(21);
  });

  it("detects a repeated client pagination cursor", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      clientResponse([], { endCursor: "same", hasNextPage: true }),
    );
    await expect(
      searchJobberClients("token", "member", { fetcher, after: "same" }),
    ).rejects.toMatchObject({ code: "cursor_loop" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["", "x".repeat(2_049)])(
    "rejects invalid opaque cursor input without a request",
    async (after) => {
      const fetcher = vi.fn();
      await expect(
        searchJobberClients("token", "member", { fetcher, after }),
      ).rejects.toMatchObject({ code: "invalid_cursor" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("detects 429 responses", async () => {
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
      }),
    ).rejects.toMatchObject({ code: "http_429" });
  });

  it("rejects partial GraphQL errors even when client data is present", async () => {
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi.fn().mockResolvedValue(
          clientResponse([client(1, "Member")], {
            errors: [{ message: "private provider detail" }],
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "graphql_partial_errors" });
  });

  it.each([
    new Response("not json"),
    new Response(
      JSON.stringify({
        data: { clients: { nodes: [] } },
        extensions: observedVersioning,
      }),
    ),
  ])("rejects malformed provider data", async (response) => {
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi.fn().mockResolvedValue(response),
      }),
    ).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("fails closed on timeout", async () => {
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi
          .fn()
          .mockRejectedValue(new DOMException("timeout", "TimeoutError")),
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("parses nested Jobber version evidence and honors the configured pin", async () => {
    vi.stubEnv("JOBBER_GRAPHQL_VERSION", "2026-02-03");
    const fetcher = vi.fn().mockResolvedValue(
      clientResponse([], {
        extensions: {
          versioning: { version: "2026-02-03", warning: null },
        },
      }),
    );
    await searchJobberClients("token", "member", { fetcher });
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      "X-JOBBER-GRAPHQL-VERSION": "2026-02-03",
    });
  });

  it("rejects nested API version warnings and mismatches", async () => {
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi.fn().mockResolvedValue(
          clientResponse([], {
            extensions: warningVersioning,
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "version_warning" });
    await expect(
      searchJobberClients("token", "member", {
        fetcher: vi.fn().mockResolvedValue(
          clientResponse([], {
            extensions: {
              versioning: { version: "2026-01-01", warning: null },
            },
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "version_mismatch" });
  });

  it.each(["2025-4-16", "2025-02-29", "2025-13-01"])(
    "rejects malformed nested API version %s",
    async (version) => {
      await expect(
        searchJobberClients("token", "member", {
          fetcher: vi.fn().mockResolvedValue(
            clientResponse([], {
              extensions: { versioning: { version, warning: null } },
            }),
          ),
        }),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it("requires nested version evidence on every client-search page", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        clientResponse([], { endCursor: "next", hasNextPage: true }),
      )
      .mockResolvedValueOnce(clientResponse([], { extensions: {} }));

    await searchJobberClients("token", "member", { fetcher });
    await expect(
      searchJobberClients("token", "member", { fetcher, after: "next" }),
    ).rejects.toMatchObject({ code: "version_unverified" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects an official version warning on a later client-search page", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        clientResponse([], { endCursor: "next", hasNextPage: true }),
      )
      .mockResolvedValueOnce(
        clientResponse([], { extensions: warningVersioning }),
      );

    await searchJobberClients("token", "member", { fetcher });
    await expect(
      searchJobberClients("token", "member", { fetcher, after: "next" }),
    ).rejects.toMatchObject({ code: "version_warning" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns one selected-client property page with continuation", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      propertyResponse(
        [
          {
            id: "property-2",
            jobberWebUri: "https://secure.getjobber.com/properties/2",
          },
        ],
        { endCursor: "property-cursor-2", hasNextPage: true },
      ),
    );
    const result = await listJobberClientPropertiesPage(
      "token",
      "client-1",
      { fetcher, after: "property-cursor-1" },
    );
    expect(result).toMatchObject({
      properties: [{ id: "property-2" }],
      endCursor: "property-cursor-2",
      hasNextPage: true,
      propertyCoverageComplete: false,
      ownershipProofPageLimit: 10,
      pagesScanned: 1,
      observedGraphqlVersion: "2025-04-16",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(
      String((fetcher.mock.calls[0]?.[1] as RequestInit).body),
    ) as { variables: Record<string, unknown> };
    expect(requestBody.variables).toEqual({
      clientId: "client-1",
      after: "property-cursor-1",
    });
  });

  it("detects a repeated selected-client property cursor", async () => {
    await expect(
      listJobberClientPropertiesPage("token", "client-1", {
        after: "same",
        fetcher: vi.fn().mockResolvedValue(
          propertyResponse([], { endCursor: "same", hasNextPage: true }),
        ),
      }),
    ).rejects.toMatchObject({ code: "cursor_loop" });
  });

  it("paginates only the selected client's property IDs and URIs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        propertyResponse(
          [{ id: "property-1", jobberWebUri: "https://secure.getjobber.com/properties/1" }],
          { endCursor: "next", hasNextPage: true },
        ),
      )
      .mockResolvedValueOnce(
        propertyResponse([
          { id: "property-1", jobberWebUri: "https://secure.getjobber.com/properties/1" },
          { id: "property-2", jobberWebUri: "https://secure.getjobber.com/properties/2" },
        ]),
      );
    const result = await listJobberClientProperties("token", "client-1", {
      fetcher,
    });
    expect(result.properties.map((property) => property.id)).toEqual([
      "property-1",
      "property-2",
    ]);
    expect(result).toMatchObject({
      propertyCoverageComplete: true,
      observedGraphqlVersion: "2025-04-16",
      pagesScanned: 2,
    });
    expect(JOBBER_CLIENT_PROPERTIES_QUERY).toContain(
      "clientProperties(first: 50, after: $after)",
    );
    expect(JOBBER_CLIENT_PROPERTIES_QUERY).not.toMatch(/\bmutation\b/i);
    const requestBody = JSON.parse(
      String((fetcher.mock.calls[0]?.[1] as RequestInit).body),
    ) as { variables: Record<string, unknown> };
    expect(requestBody.variables).toEqual({
      clientId: "client-1",
      after: null,
    });
  });

  it("bounds client-property pagination and reports incomplete coverage", async () => {
    const fetcher = vi.fn();
    for (let page = 0; page < 10; page += 1) {
      fetcher.mockResolvedValueOnce(
        propertyResponse([], {
          endCursor: `property-cursor-${page}`,
          hasNextPage: true,
        }),
      );
    }
    const result = await listJobberClientProperties("token", "client-1", {
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(result.propertyCoverageLimitReached).toBe(true);
    expect(result.propertyCoverageComplete).toBe(false);
  });

  it("requires matching nested version evidence on every client-property page", async () => {
    const missingFetcher = vi
      .fn()
      .mockResolvedValueOnce(
        propertyResponse([], { endCursor: "next", hasNextPage: true }),
      )
      .mockResolvedValueOnce(propertyResponse([], { extensions: {} }));
    await expect(
      listJobberClientProperties("token", "client-1", {
        fetcher: missingFetcher,
      }),
    ).rejects.toMatchObject({ code: "version_unverified" });
    expect(missingFetcher).toHaveBeenCalledTimes(2);

    const mismatchedFetcher = vi
      .fn()
      .mockResolvedValueOnce(
        propertyResponse([], { endCursor: "next", hasNextPage: true }),
      )
      .mockResolvedValueOnce(
        propertyResponse([], {
          extensions: {
            versioning: { version: "2026-01-01", warning: null },
          },
        }),
      );
    await expect(
      listJobberClientProperties("token", "client-1", {
        fetcher: mismatchedFetcher,
      }),
    ).rejects.toMatchObject({ code: "version_mismatch" });
    expect(mismatchedFetcher).toHaveBeenCalledTimes(2);
  });

  it("returns durable ownership evidence only after complete coverage", async () => {
    const evidence = await proveJobberClientPropertyOwnership(
      "token",
      " client-1 ",
      "property-2",
      {
        now: () => "2026-07-18T12:34:56.000Z",
        fetcher: vi.fn().mockResolvedValue(
          propertyResponse([
            {
              id: "property-2",
              jobberWebUri:
                "https://secure.getjobber.com/properties/property-2",
            },
          ]),
        ),
      },
    );
    expect(evidence).toEqual({
      clientId: "client-1",
      externalPropertyId: "property-2",
      jobberPropertyWebUri:
        "https://secure.getjobber.com/properties/property-2",
      observedGraphqlVersion: "2025-04-16",
      observedAt: "2026-07-18T12:34:56.000Z",
      pagesScanned: 1,
      propertyCoverageComplete: true,
    });
  });

  it("fails ownership proof when coverage is incomplete or version evidence is absent", async () => {
    const incompleteFetcher = vi.fn();
    for (let page = 0; page < 10; page += 1) {
      incompleteFetcher.mockResolvedValueOnce(
        propertyResponse(
          page === 0
            ? [{
                id: "property-owned",
                jobberWebUri:
                  "https://secure.getjobber.com/properties/owned",
              }]
            : [],
          {
            endCursor: `property-cursor-${page}`,
            hasNextPage: true,
          },
        ),
      );
    }
    await expect(
      proveJobberClientPropertyOwnership(
        "token",
        "client-1",
        "property-owned",
        { fetcher: incompleteFetcher },
      ),
    ).rejects.toMatchObject({ code: "property_coverage_incomplete" });

    await expect(
      proveJobberClientPropertyOwnership(
        "token",
        "client-1",
        "property-owned",
        {
          fetcher: vi.fn().mockResolvedValue(
            propertyResponse(
              [{
                id: "property-owned",
                jobberWebUri:
                  "https://secure.getjobber.com/properties/owned",
              }],
              { extensions: {} },
            ),
          ),
        },
      ),
    ).rejects.toMatchObject({ code: "version_unverified" });
  });

  it("queries no customer contact, address, visit, or mutation fields", () => {
    expect(JOBBER_CLIENT_SEARCH_QUERY).not.toMatch(
      /email|phone|address|visit|appointment|\bmutation\b/i,
    );
    expect(JOBBER_CLIENT_PROPERTIES_QUERY).not.toMatch(
      /email|phone|address|visit|appointment|\bmutation\b/i,
    );
  });
});
