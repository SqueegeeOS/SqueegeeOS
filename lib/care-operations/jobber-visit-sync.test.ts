import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllJobberVisits,
  fetchJobberVisitPage,
  JOBBER_PAGE_SIZE,
  JOBBER_VISITS_SCHEDULING_ONLY_QUERY,
  JOBBER_VISITS_QUERY,
  JOBBER_VISITS_WITHOUT_ASSIGNMENTS_QUERY,
  JOBBER_VISITS_WITHOUT_INVOICE_QUERY,
  JOBBER_VISITS_WITHOUT_SCOPE_QUERY,
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
  invoiceReadState: "available",
  assignedUsers: [{ id: "user-1", name: "Alex Rivera" }],
  assignmentReadState: "available",
  scopeItems: [
    {
      id: "line-1",
      name: "Exterior window cleaning",
      description: "Exterior glass and frames",
      quantity: 1,
      category: "SERVICE",
      totalPrice: 225,
    },
    {
      id: "line-2",
      name: "Screens",
      description: null,
      quantity: 12,
      category: "SERVICE",
      totalPrice: 50,
    },
  ],
  scopeReadState: "available",
  client: { id: "client-1", name: "Home Owner" },
  property: {
    id: "jobber-property-1",
    name: "Home",
    jobberWebUri: "https://secure.getjobber.com/properties/jobber-property-1",
    address: {
      street1: "42 Canyon Road",
      street2: null,
      city: "Chico",
      province: "CA",
      postalCode: "95928",
      country: "US",
    },
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

function jobberVisitTransport(source: JobberVisitNode = visit) {
  const {
    invoiceReadState: _invoiceReadState,
    assignmentReadState: _assignmentReadState,
    assignedUsers,
    scopeReadState: _scopeReadState,
    scopeItems,
    ...rest
  } = source;
  void _invoiceReadState;
  void _assignmentReadState;
  void _scopeReadState;
  return {
    ...rest,
    assignedUsers: {
      nodes: assignedUsers.map((user) => ({
        id: user.id,
        name: { full: user.name },
      })),
    },
    lineItems: {
      nodes: scopeItems,
      pageInfo: { hasNextPage: source.scopeReadState === "partial" },
    },
  };
}

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
    expect(JOBBER_VISITS_QUERY).toContain("invoice { id invoiceStatus }");
    expect(JOBBER_VISITS_QUERY).toContain(
      "assignedUsers(first: 25) { nodes { id name { full } } }",
    );
    expect(JOBBER_VISITS_QUERY).toContain("lineItems(first: 50)");
    expect(JOBBER_VISITS_QUERY).toContain(
      "nodes { id name description quantity category totalPrice }",
    );
    expect(JOBBER_VISITS_WITHOUT_INVOICE_QUERY).not.toContain("invoice {");
    expect(JOBBER_VISITS_WITHOUT_ASSIGNMENTS_QUERY).not.toContain(
      "assignedUsers(",
    );
    expect(JOBBER_VISITS_WITHOUT_SCOPE_QUERY).not.toContain("lineItems(");
    expect(JOBBER_VISITS_SCHEDULING_ONLY_QUERY).not.toContain("invoice {");
    expect(JOBBER_VISITS_SCHEDULING_ONLY_QUERY).not.toContain(
      "assignedUsers(",
    );
    expect(JOBBER_VISITS_SCHEDULING_ONLY_QUERY).not.toContain("lineItems(");
  });

  it("requests a bounded visit page using JSON and the pinned API version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            visits: {
              nodes: [jobberVisitTransport()],
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

  it("falls back to scheduling truth and marks invoice visibility hidden", async () => {
    const { invoice: _invoice, ...restrictedVisit } = jobberVisitTransport();
    void _invoice;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message:
                  "An object of type Invoice was hidden due to permissions",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [restrictedVisit],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const sample = await fetchJobberVisitPage("access-token", { first: 5 });

    expect(sample.nodes[0]).toMatchObject({
      id: "visit-1",
      invoice: null,
      invoiceReadState: "permission_hidden",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackBody = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as { query: string };
    expect(fallbackBody.query).toBe(JOBBER_VISITS_WITHOUT_INVOICE_QUERY);
  });

  it("keeps the schedule available when Jobber hides crew users", async () => {
    const { assignedUsers: _assignedUsers, ...visitWithoutCrew } =
      jobberVisitTransport();
    void _assignedUsers;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: "An object of type User was hidden due to permissions",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [visitWithoutCrew],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const sample = await fetchJobberVisitPage("access-token", { first: 5 });

    expect(sample.nodes[0]).toMatchObject({
      id: "visit-1",
      assignedUsers: [],
      assignmentReadState: "permission_hidden",
      invoiceReadState: "available",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackBody = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as { query: string };
    expect(fallbackBody.query).toBe(JOBBER_VISITS_WITHOUT_ASSIGNMENTS_QUERY);
  });

  it("falls back to schedule-only truth when every optional scope is hidden", async () => {
    const transport = jobberVisitTransport();
    const {
      invoice: _invoice,
      assignedUsers: _assignedUsers,
      lineItems: _lineItems,
      ...scheduleOnlyVisit
    } = transport;
    void _invoice;
    void _assignedUsers;
    void _lineItems;
    const permissionResponse = (type: "Invoice" | "User" | "JobLineItem") =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: `An object of type ${type} was hidden due to permissions`,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(permissionResponse("Invoice"))
      .mockResolvedValueOnce(permissionResponse("User"))
      .mockResolvedValueOnce(permissionResponse("JobLineItem"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [scheduleOnlyVisit],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const sample = await fetchJobberVisitPage("access-token", { first: 5 });

    expect(sample.nodes[0]).toMatchObject({
      invoice: null,
      invoiceReadState: "permission_hidden",
      assignedUsers: [],
      assignmentReadState: "permission_hidden",
      scopeItems: [],
      scopeReadState: "permission_hidden",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const finalBody = JSON.parse(
      String((fetchMock.mock.calls[3] as [string, RequestInit])[1].body),
    ) as { query: string };
    expect(finalBody.query).toBe(JOBBER_VISITS_SCHEDULING_ONLY_QUERY);
  });

  it("keeps the schedule and crew available when Jobber hides service line items", async () => {
    const { lineItems: _lineItems, ...visitWithoutScope } =
      jobberVisitTransport();
    void _lineItems;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message:
                  "An object of type JobLineItem was hidden due to permissions",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              visits: {
                nodes: [visitWithoutScope],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const sample = await fetchJobberVisitPage("access-token", { first: 5 });

    expect(sample.nodes[0]).toMatchObject({
      id: "visit-1",
      assignedUsers: [{ id: "user-1", name: "Alex Rivera" }],
      assignmentReadState: "available",
      scopeItems: [],
      scopeReadState: "permission_hidden",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackBody = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as { query: string };
    expect(fallbackBody.query).toBe(JOBBER_VISITS_WITHOUT_SCOPE_QUERY);
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
                nodes: [jobberVisitTransport()],
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
                nodes: [jobberVisitTransport()],
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
                nodes: [jobberVisitTransport(secondVisit)],
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
    const firstBody = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { variables: { first: number } };
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as { variables: { first: number; after: string | null } };
    expect(JOBBER_PAGE_SIZE).toBe(10);
    expect(firstBody.variables.first).toBe(10);
    expect(secondBody.variables.first).toBe(10);
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
      property_name: "Home",
      property_address: {
        street1: "42 Canyon Road",
        city: "Chico",
        province: "CA",
      },
      visit_status: "UPCOMING",
      client_confirmed: true,
      job_billing_type: "PER_VISIT",
      job_total_cents: 27500,
      job_will_auto_charge: false,
      visit_invoice_status: "NONE",
      is_complete: false,
      raw_payload: {
        assignedUsers: [{ id: "user-1", name: "Alex Rivera" }],
        assignmentReadState: "available",
        scopeItems: visit.scopeItems,
        scopeReadState: "available",
      },
    });
    expect(row.search_text).toContain("alex rivera");
    expect(row.search_text).toContain("exterior window cleaning");
    expect(row).not.toHaveProperty("matched_property_id");
    expect(row).not.toHaveProperty("matched_obligation_id");
    expect(row).not.toHaveProperty("match_state");
  });

  it("holds billing when Jobber hides invoice visibility", () => {
    const row = toJobberVisitProjectionRow(
      { ...visit, invoiceReadState: "permission_hidden" },
      "2026-07-12T16:00:00.000Z",
    );

    expect(row).toMatchObject({
      job_will_auto_charge: true,
      visit_invoice_id: null,
      visit_invoice_status: "PERMISSION_HIDDEN",
    });
  });

  it("produces a stable hash that changes with source truth", () => {
    expect(hashJobberVisitPayload(visit)).toBe(hashJobberVisitPayload({ ...visit }));
    expect(hashJobberVisitPayload(visit)).not.toBe(
      hashJobberVisitPayload({ ...visit, visitStatus: "COMPLETED" }),
    );
    expect(hashJobberVisitPayload(visit)).not.toBe(
      hashJobberVisitPayload({ ...visit, assignedUsers: [] }),
    );
    expect(hashJobberVisitPayload(visit)).not.toBe(
      hashJobberVisitPayload({ ...visit, scopeItems: [] }),
    );
  });
});
