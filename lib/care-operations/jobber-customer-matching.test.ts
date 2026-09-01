import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllJobberClients,
  buildJobberClientsQuery,
  JOBBER_CLIENTS_QUERY,
  supportsExactJobberPropertyAddress,
  type JobberClientNode,
} from "./jobber-api";
import {
  hashJobberClientPayload,
  jobberCustomerQueueIncludesDecision,
  summarizeJobberCustomerQueues,
  toJobberClientProjectionRow,
} from "./jobber-customer-matching";

const client: JobberClientNode = {
  id: "client-1",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: null,
  email: "ada@example.com",
  phone: "555-0100",
  jobberWebUri: "https://secure.getjobber.com/clients/client-1",
  isArchived: false,
  clientProperties: {
    nodes: [
      {
        id: "property-1",
        name: "Canyon House",
        jobberWebUri: "https://secure.getjobber.com/properties/property-1",
        address: {
          street1: "42 Canyon Road",
          street2: null,
          city: "Chico",
          province: "CA",
          postalCode: "95928",
          country: "US",
        },
      },
    ],
    pageInfo: { endCursor: "property-cursor", hasNextPage: false },
    totalCount: 1,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jobber customer synchronization", () => {
  it("prioritizes ambiguous and conflicting identities in the safe inbox", () => {
    const decisions = [
      { outcome: "manual_review" as const },
      { outcome: "conflict" as const },
      { outcome: "insufficient_evidence" as const },
      { outcome: "already_linked" as const },
      { outcome: "archived" as const },
    ];
    expect(summarizeJobberCustomerQueues(decisions)).toEqual({
      review: 2,
      unpaired: 3,
      paired: 1,
      all: 5,
    });
    expect(
      jobberCustomerQueueIncludesDecision("review", {
        outcome: "insufficient_evidence",
      }),
    ).toBe(false);
  });

  it("uses a read-only cursor query with searchable customer fields", () => {
    expect(JOBBER_CLIENTS_QUERY).toContain("query HomeAtlasClients");
    expect(JOBBER_CLIENTS_QUERY).toContain("clients(first: $first, after: $after)");
    expect(JOBBER_CLIENTS_QUERY).toContain("clientProperties(first: 25)");
    expect(JOBBER_CLIENTS_QUERY).not.toMatch(/\bmutation\b/i);
    expect(buildJobberClientsQuery(["street", "city", "province", "postalCode"]))
      .toContain("address { street city province postalCode }");
    expect(buildJobberClientsQuery(["unsafeField"])).toBe(JOBBER_CLIENTS_QUERY);
    expect(
      supportsExactJobberPropertyAddress([
        "street",
        "city",
        "province",
        "postalCode",
      ]),
    ).toBe(true);
    expect(
      supportsExactJobberPropertyAddress(["city", "province", "postalCode"]),
    ).toBe(false);
  });

  it("loads every client page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              clients: {
                nodes: [
                  {
                    clientProperties: {
                      nodes: [{ address: { __typename: "ServiceAddress" } }],
                    },
                  },
                ],
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
              __type: {
                fields: [
                  { name: "street", type: { kind: "SCALAR", name: "String", ofType: null } },
                  { name: "city", type: { kind: "SCALAR", name: "String", ofType: null } },
                  { name: "province", type: { kind: "SCALAR", name: "String", ofType: null } },
                  { name: "postalCode", type: { kind: "SCALAR", name: "String", ofType: null } },
                ],
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
              clients: {
                nodes: [client],
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
              clients: {
                nodes: [{ ...client, id: "client-2", name: "Grace Hopper" }],
                pageInfo: { endCursor: "cursor-2", hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllJobberClients("access-token");
    expect(result.nodes.map((node) => node.id)).toEqual(["client-1", "client-2"]);
    expect(result.pageCount).toBe(2);
    expect(result.addressReadState).toBe("available");
    expect(result.addressFields).toEqual([
      "street",
      "city",
      "province",
      "postalCode",
    ]);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain(
      '"typeName":"ServiceAddress"',
    );
  });

  it("fails closed when Jobber exposes no property address type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              clients: {
                nodes: [{ clientProperties: { nodes: [] } }],
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
              clients: {
                nodes: [client],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllJobberClients("access-token");
    expect(result.addressReadState).toBe("unavailable");
    expect(result.addressFields).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stores a searchable read-only projection", () => {
    const row = toJobberClientProjectionRow(
      client,
      "2026-07-28T00:00:00.000Z",
    );
    expect(row).toMatchObject({
      external_client_id: "client-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      property_count: 1,
      properties_complete: true,
    });
    expect(row.search_text).toContain("ada lovelace");
    expect(row.search_text).toContain("canyon house");
    expect(row.search_text).toContain("42 canyon road");
    expect(row.properties[0]?.address).toMatchObject({
      city: "Chico",
      province: "CA",
    });
    expect(hashJobberClientPayload(client)).toBe(
      hashJobberClientPayload({ ...client }),
    );
  });

  it("keeps customer links supervised, private, and append-only", () => {
    const sql = readFileSync(
      new URL(
        "../persistence/supabase/migrations/035_jobber_full_sync_and_customer_links.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain("identity links");
    expect(sql).toContain("Revoke the active Jobber customer link");
    expect(sql).toContain("only during an audited relink");
    expect(sql).toContain("history is immutable");
    expect(sql).toContain("jobber_customer_links_no_delete");
    expect(sql).toContain(
      "alter table public.jobber_customer_links enable row level security",
    );
  });

  it("requires current Jobber evidence before a supervised pairing", () => {
    const service = readFileSync(
      new URL("./jobber-customer-matching.ts", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL(
        "../../app/api/admin/care-operations/jobber/customers/route.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const panel = readFileSync(
      new URL(
        "../../components/admin/jobber-customer-pairing-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(service).toContain("expectedSourcePayloadHash");
    expect(service).toContain("source_payload_hash !== expectedSourcePayloadHash");
    expect(route).toContain("!body.expectedSourcePayloadHash");
    expect(panel).toContain('useState<CustomerQueue>("review")');
    expect(panel).toContain("EvidenceRow");
    expect(panel).toContain("cannot enable billing");
    expect(panel).not.toContain("Pair Jobber ${client.name}");
    expect(panel).toContain("pairingStatuses");
    expect(panel).toContain('aria-live="polite"');
  });

  it("keeps raw customer-link writes separate from appointments and billing", () => {
    const service = readFileSync(
      new URL("./jobber-customer-matching.ts", import.meta.url),
      "utf8",
    );
    expect(service).not.toContain('.from("member_appointments")');
    expect(service).not.toContain('.from("obligations")');
    expect(service).not.toContain('.from("billing_orders")');
    expect(service).not.toMatch(/\bmutation\b/i);
  });
});
