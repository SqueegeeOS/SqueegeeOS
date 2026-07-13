import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchJobberVisitSample,
  JOBBER_VISIT_SAMPLE_QUERY,
  type JobberVisitSampleNode,
} from "./jobber-api";
import {
  hashJobberVisitPayload,
  toJobberVisitProjectionRow,
} from "./jobber-visit-sample";

const visit: JobberVisitSampleNode = {
  id: "visit-1",
  title: "Quarterly window care",
  visitStatus: "UPCOMING",
  isComplete: false,
  startAt: "2026-08-12T16:00:00Z",
  endAt: "2026-08-12T18:00:00Z",
  completedAt: null,
  client: { id: "client-1", name: "Home Owner" },
  property: {
    id: "jobber-property-1",
    jobberWebUri: "https://secure.getjobber.com/properties/jobber-property-1",
  },
  job: {
    id: "job-1",
    jobNumber: 42,
    title: "Window care",
    jobStatus: "ACTIVE",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("read-only Jobber visit sample", () => {
  it("contains one fixed query and no mutation operation", () => {
    expect(JOBBER_VISIT_SAMPLE_QUERY).toContain("query HomeAtlasVisitSample");
    expect(JOBBER_VISIT_SAMPLE_QUERY).not.toMatch(/\bmutation\b/i);
    expect(JOBBER_VISIT_SAMPLE_QUERY).not.toMatch(
      /invoice|payment|price|total|instructions|notes/i,
    );
    expect(JOBBER_VISIT_SAMPLE_QUERY).toContain("jobberWebUri");
  });

  it("requests a bounded visit page using JSON and the pinned API version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            visits: {
              nodes: [visit],
              pageInfo: { endCursor: "cursor-1", hasNextPage: true },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sample = await fetchJobberVisitSample("access-token", 5);
    expect(sample.nodes).toEqual([visit]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.getjobber.com/api/graphql");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": "2025-04-16",
    });
    const body = JSON.parse(String(init.body)) as {
      query: string;
      variables: { first: number };
    };
    expect(body.query).toBe(JOBBER_VISIT_SAMPLE_QUERY);
    expect(body.variables).toEqual({ first: 5 });
  });

  it("rejects an unbounded request before contacting Jobber", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJobberVisitSample("access-token", 11)).rejects.toThrow(
      "between 1 and 10",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an unlinked source projection without HomeAtlas identity fields", () => {
    const row = toJobberVisitProjectionRow(
      visit,
      "2026-07-12T16:00:00.000Z",
    );
    expect(row).toMatchObject({
      provider: "jobber",
      external_visit_id: "visit-1",
      external_job_id: "job-1",
      external_client_id: "client-1",
      external_property_id: "jobber-property-1",
      jobber_property_web_uri:
        "https://secure.getjobber.com/properties/jobber-property-1",
      visit_status: "UPCOMING",
      is_complete: false,
    });
    expect(row).not.toHaveProperty("matched_property_id");
    expect(row).not.toHaveProperty("matched_obligation_id");
    expect(row).not.toHaveProperty("match_state");
  });

  it("produces a stable hash that changes with source truth", () => {
    expect(hashJobberVisitPayload(visit)).toBe(hashJobberVisitPayload({ ...visit }));
    expect(hashJobberVisitPayload(visit)).not.toBe(
      hashJobberVisitPayload({ ...visit, visitStatus: "COMPLETED" }),
    );
  });
});
