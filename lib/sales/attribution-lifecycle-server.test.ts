import { afterEach, describe, expect, it, vi } from "vitest";

let attributionResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
let repResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
let membershipResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
let homeownerResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};

function chain(result: () => { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "in", "not", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result()).then(onfulfilled, onrejected);
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  if (table === "sales_rep_attributions") return chain(() => attributionResult);
  if (table === "sales_reps") return chain(() => repResult);
  if (table === "memberships") return chain(() => membershipResult);
  if (table === "homeowners") return chain(() => homeownerResult);
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

describe("sales retention attention server", () => {
  afterEach(() => {
    attributionResult = { data: [], error: null };
    repResult = { data: [], error: null };
    membershipResult = { data: [], error: null };
    homeownerResult = { data: [], error: null };
    vi.clearAllMocks();
  });

  it("returns due and cancelled retention drift without updating the ledger", async () => {
    attributionResult = {
      data: [
        {
          id: "attribution-due",
          rep_id: "rep-1",
          lead_id: "lead-1",
          membership_id: "membership-due",
          qualification_status: "active",
          retention_qualifies_at: "2026-08-13T18:00:00.000Z",
          qualified_at: null,
        },
        {
          id: "attribution-cancelled",
          rep_id: "rep-1",
          lead_id: "lead-2",
          membership_id: "membership-cancelled",
          qualification_status: "active",
          retention_qualifies_at: "2026-09-01T18:00:00.000Z",
          qualified_at: null,
        },
        {
          id: "attribution-future",
          rep_id: "rep-1",
          lead_id: "lead-3",
          membership_id: "membership-future",
          qualification_status: "active",
          retention_qualifies_at: "2026-09-01T18:00:00.000Z",
          qualified_at: null,
        },
      ],
      error: null,
    };
    repResult = {
      data: [{ id: "rep-1", slug: "david", display_name: "David" }],
      error: null,
    };
    membershipResult = {
      data: [
        {
          id: "membership-due",
          homeowner_id: "homeowner-due",
          status: "active",
        },
        {
          id: "membership-cancelled",
          homeowner_id: "homeowner-cancelled",
          status: "cancelled",
        },
        {
          id: "membership-future",
          homeowner_id: "homeowner-future",
          status: "active",
        },
      ],
      error: null,
    };
    homeownerResult = {
      data: [
        { id: "homeowner-due", full_name: "Jeff Mason" },
        { id: "homeowner-cancelled", full_name: "Joani Hall" },
        { id: "homeowner-future", full_name: "Future Member" },
      ],
      error: null,
    };

    const { loadSalesRetentionAttentionSnapshot } = await import(
      "./attribution-lifecycle-server"
    );
    const snapshot = await loadSalesRetentionAttentionSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      generatedAt: "2026-08-14T18:00:00.000Z",
      truncated: false,
    });
    expect(snapshot.records).toEqual([
      expect.objectContaining({
        attributionId: "attribution-due",
        homeownerName: "Jeff Mason",
        membershipStatus: "active",
      }),
      expect.objectContaining({
        attributionId: "attribution-cancelled",
        homeownerName: "Joani Hall",
        membershipStatus: "cancelled",
      }),
    ]);
    expect(snapshot.records).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributionId: "attribution-future" }),
      ]),
    );
  });
});
