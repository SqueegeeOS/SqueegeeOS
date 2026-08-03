import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllJobberVisits,
  fetchJobberVisitPage,
  JOBBER_VISITS_QUERY,
  type JobberVisitNode,
} from "./jobber-api";
import {
  hashJobberVisitPayload,
  toJobberVisitProjectionRow,
} from "./jobber-visit-sync";

const visit: JobberVisitNode = {
  id: "visit-1",
  title: "Quarterly window care",
  visitStatus: "UPCOMING",
  isComplete: false,
  clientConfirmed: true,
  isLastScheduledVisit: false,
  startAt: "2026-08-12T16:00:00Z",
  endAt: "2026-08-12T18:00:00Z",
  completedAt: null,
  invoice: null,
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
    jobType: "RECURRING",
    billingType: "PER_VISIT",
    total: 275,
    willClientBeAutomaticallyCharged: false,
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("complete read-only Jobber visit synchronization", () => {
  it("contains one fixed query and no mutation operation", () => {
    expect(JOBBER_VISITS_QUERY).toContain("query HomeAtlasVisits");
    expect(JOBBER_VISITS_QUERY).toContain("after: $after");
    expect(JOBBER_VISITS_QUERY).not.toMatch(/\bmutation\b/i);
    expect(JOBBER_VISITS_QUERY).toContain("total");
    expect(JOBBER_VISITS_QUERY).toContain("billingType");
    expect(JOBBER_VISITS_QUERY).toContain("willClientBeAutomaticallyCharged");
    expect(JOBBER_VISITS_QUERY).toContain("jobberWebUri");
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

    const sample = await fetchJobberVisitPage("access-token", { first: 5 });
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
      variables: { first: number; after: string | null };
    };
    expect(body.query).toBe(JOBBER_VISITS_QUERY);
    expect(body.variables).toEqual({ first: 5, after: null });
  });

  it("rejects an unbounded request before contacting Jobber", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchJobberVisitPage("access-token", { first: 101 }),
    ).rejects.toThrow(
      "between 1 and 100",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for Jobber capacity and retries a throttled query", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              { message: "Throttled", extensions: { code: "THROTTLED" } },
            ],
            extensions: {
              cost: {
                requestedQueryCost: 1_000,
                actualQueryCost: 0,
                throttleStatus: {
                  maximumAvailable: 10_000,
                  currentlyAvailable: 500,
                  restoreRate: 500,
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [visit],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pendingPage = fetchJobberVisitPage("access-token", { first: 5 });
    await vi.advanceTimersByTimeAsync(1_250);

    await expect(pendingPage).resolves.toMatchObject({ nodes: [visit] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("follows every Jobber cursor until all visits are loaded", async () => {
    const secondVisit = { ...visit, id: "visit-2" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [secondVisit],
                pageInfo: { endCursor: "cursor-2", hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllJobberVisits("access-token");
    expect(result.nodes.map((node) => node.id)).toEqual(["visit-1", "visit-2"]);
    expect(result.pageCount).toBe(2);
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as { variables: { after: string | null } };
    expect(secondBody.variables.after).toBe("cursor-1");
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
      client_confirmed: true,
      job_billing_type: "PER_VISIT",
      job_total_cents: 27500,
      job_will_auto_charge: false,
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
