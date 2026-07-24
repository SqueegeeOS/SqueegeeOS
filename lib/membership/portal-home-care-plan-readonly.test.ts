import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const remove = vi.fn();
  const from = vi.fn();

  function query(result: { data: unknown; error: null }) {
    const promise = Promise.resolve(result);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(() => promise);
    builder.insert = insert;
    builder.update = update;
    builder.upsert = upsert;
    builder.delete = remove;
    return builder;
  }

  from.mockImplementation((table: string) => {
    if (table === "homeowners") {
      return query({
        data: {
          id: "homeowner-1",
          slug: "legacy-member",
          full_name: "Legacy Member",
        },
        error: null,
      });
    }
    if (table === "properties") {
      return query({
        data: {
          id: "property-1",
          slug: "legacy-home",
          name: "Legacy Home",
          address: "123 Main St",
          city: "Chico",
          state: "CA",
          square_feet: 1800,
        },
        error: null,
      });
    }
    if (table === "memberships") {
      return query({
        data: {
          plan_name: "Bi-Annual Care",
          sales_tier: "biannual",
          visit_price: 245,
          presentation_id: null,
        },
        error: null,
      });
    }
    return query({ data: null, error: null });
  });

  return {
    client: { from },
    from,
    insert,
    update,
    upsert,
    remove,
    loadGeneratedHomeCarePlan: vi.fn(),
  };
});

vi.mock("@/lib/persistence/repository", () => ({
  loadGeneratedHomeCarePlan: mocks.loadGeneratedHomeCarePlan,
}));

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: () => mocks.client,
  isSupabaseConfigured: () => true,
}));

import { loadPortalHomeCarePlan } from "./portal-home-care-plan";

describe("loadPortalHomeCarePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGeneratedHomeCarePlan.mockResolvedValue(null);
  });

  it("builds a legacy fallback in memory without writing during portal load", async () => {
    const plan = await loadPortalHomeCarePlan("legacy-member", "legacy-home");

    expect(plan?.homeowner.fullName).toBe("Legacy Member");
    expect(plan?.memberships[0]?.visitPrice).toBe(245);
    expect(mocks.from).not.toHaveBeenCalledWith("home_care_plans");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
