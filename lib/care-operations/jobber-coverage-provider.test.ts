import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobberVisitSampleNode } from "./jobber-api";
import {
  fetchJobberCoverageWindow,
  hashCanonicalJobberVisit,
  JOBBER_VISIT_COVERAGE_QUERY,
  JobberCoverageError,
} from "./jobber-coverage-provider";

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

const window = {
  startAt: "2026-07-01T07:00:00.000Z",
  endAt: "2026-07-02T07:00:00.000Z",
};

function visit(overrides: Partial<JobberVisitSampleNode> = {}): JobberVisitSampleNode {
  return {
    id: "visit-1",
    title: "Provider visit",
    visitStatus: "OPAQUE_PROVIDER_VALUE",
    isComplete: false,
    startAt: "2026-07-01T16:00:00.000Z",
    endAt: "2026-07-01T18:00:00.000Z",
    completedAt: null,
    client: { id: "client-1", name: "Sanitized client" },
    property: {
      id: "property-1",
      jobberWebUri: "https://secure.getjobber.com/properties/property-1",
    },
    job: {
      id: "job-1",
      jobNumber: 1,
      title: "Provider job",
      jobStatus: "OPAQUE_JOB_VALUE",
    },
    ...overrides,
  };
}

function response(
  nodes: unknown[] = [visit()],
  options: {
    hasNextPage?: boolean;
    headers?: HeadersInit;
    errors?: unknown;
    extensions?: Record<string, unknown>;
  } = {},
) {
  return new Response(
    JSON.stringify({
      data: {
        visits: {
          nodes,
          pageInfo: { hasNextPage: options.hasNextPage ?? false },
        },
      },
      errors: options.errors,
      extensions: options.extensions ?? observedVersioning,
    }),
    { status: 200, headers: options.headers },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Jobber coverage provider boundary", () => {
  it("uses only fixed first:50 half-open startAt filters and never cursor traversal", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const page = await fetchJobberCoverageWindow("access-token", window, {
      fetcher,
    });
    expect(page.nodes[0]?.visitStatus).toBe("OPAQUE_PROVIDER_VALUE");
    expect(JOBBER_VISIT_COVERAGE_QUERY).toContain("visits(first: 50, filter: $filter)");
    expect(JOBBER_VISIT_COVERAGE_QUERY).not.toMatch(/endCursor|\$after|after\s*:/);
    expect(JOBBER_VISIT_COVERAGE_QUERY).not.toMatch(/\bmutation\b/i);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.getjobber.com/api/graphql");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "X-JOBBER-GRAPHQL-VERSION": "2025-04-16",
    });
    const body = JSON.parse(String(init.body)) as {
      variables: { filter: { startAt: Record<string, string> } };
    };
    expect(body.variables.filter.startAt).toEqual({
      min: window.startAt,
      before: window.endAt,
    });
  });

  it("rejects partial GraphQL errors even when data is present", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([visit()], { errors: [{ message: "partial" }] }),
        ),
      }),
    ).rejects.toMatchObject({ code: "graphql_partial_errors" });
  });

  it("rejects a present non-array GraphQL errors field as malformed", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([visit()], { errors: { message: "malformed" } }),
        ),
      }),
    ).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("accepts an explicitly empty GraphQL errors array", async () => {
    const page = await fetchJobberCoverageWindow("token", window, {
      fetcher: vi.fn().mockResolvedValue(response([visit()], { errors: [] })),
    });
    expect(page.nodes).toHaveLength(1);
  });

  it("uses the simulated 429 fixture without contacting Jobber", async () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("./fixtures/jobber-simulated-429.json", import.meta.url),
        "utf8",
      ),
    ) as { status: number; headers: HeadersInit; body: unknown };
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fixture.body), {
            status: fixture.status,
            headers: fixture.headers,
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "http_429" });
  });

  it("fails closed on timeout", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockRejectedValue(
          new DOMException("simulated timeout", "TimeoutError"),
        ),
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("fails closed on malformed timestamps", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([{ ...visit(), startAt: "not-a-timestamp" }]),
        ),
      }),
    ).rejects.toMatchObject({ code: "malformed_timestamp" });
  });

  it.each(["2026-02-30T12:00:00Z", "2025-02-29T12:00:00-08:00"])(
    "rejects impossible calendar timestamp %s",
    async (startAt) => {
      await expect(
        fetchJobberCoverageWindow("token", window, {
          fetcher: vi.fn().mockResolvedValue(
            response([{ ...visit(), startAt }]),
          ),
        }),
      ).rejects.toMatchObject({ code: "malformed_timestamp" });
    },
  );

  it("accepts a leap date with an offset and canonicalizes it to UTC", async () => {
    const page = await fetchJobberCoverageWindow("token", window, {
      fetcher: vi.fn().mockResolvedValue(
        response([{ ...visit(), startAt: "2024-02-29T23:30:00-08:00" }]),
      ),
    });
    expect(page.nodes[0]?.startAt).toBe("2024-03-01T07:30:00.000Z");
  });

  it("uses the simulated warning fixture and rejects version warnings", async () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "./fixtures/jobber-simulated-version-warning.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { status: number; headers: HeadersInit; body: unknown };
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fixture.body), {
            status: fixture.status,
            headers: fixture.headers,
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "version_warning" });
  });

  it("rejects a response version mismatch", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([], {
            headers: { "x-jobber-graphql-version": "2026-01-01" },
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "version_mismatch" });
  });

  it("rejects an official nested version warning", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([], { extensions: warningVersioning }),
        ),
      }),
    ).rejects.toMatchObject({ code: "version_warning" });
  });

  it("rejects an official nested version mismatch", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([], {
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
        fetchJobberCoverageWindow("token", window, {
          fetcher: vi.fn().mockResolvedValue(
            response([], {
              extensions: { versioning: { version, warning: null } },
            }),
          ),
        }),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it("rejects missing official nested version evidence", async () => {
    await expect(
      fetchJobberCoverageWindow("token", window, {
        fetcher: vi.fn().mockResolvedValue(
          response([], { extensions: {} }),
        ),
      }),
    ).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("canonicalizes source hashes independent of object property order", () => {
    const original = visit();
    const reordered = {
      ...original,
      job: {
        jobStatus: original.job.jobStatus,
        title: original.job.title,
        jobNumber: original.job.jobNumber,
        id: original.job.id,
      },
    } as JobberVisitSampleNode;
    expect(hashCanonicalJobberVisit(original)).toBe(
      hashCanonicalJobberVisit(reordered),
    );
    expect(hashCanonicalJobberVisit(original)).not.toBe(
      hashCanonicalJobberVisit({ ...original, visitStatus: "CHANGED" }),
    );
  });

  it("uses a dedicated typed error for provider coverage failures", () => {
    expect(new JobberCoverageError("timeout", "timeout")).toBeInstanceOf(Error);
  });
});
