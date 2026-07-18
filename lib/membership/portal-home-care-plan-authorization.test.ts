import { beforeEach, describe, expect, it, vi } from "vitest";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

const mocks = vi.hoisted(() => {
  const results = {} as Record<
    string,
    Array<{ data: unknown; error: { message: string } | null }>
  >;
  const eqCalls: Array<[string, string, unknown]> = [];
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        eqCalls.push([table, column, value]);
        return query;
      });
      query.maybeSingle = vi.fn(async () =>
        (results[table] ?? []).shift(),
      );
      query.upsert = upsert;
      return query;
    });

  return {
    results,
    eqCalls,
    upsert,
    getPresentationForPortalAccess: vi.fn(),
    client: { from },
  };
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => mocks.client),
}));

vi.mock("@/lib/presentations/repository", () => ({
  getPresentationForPortalAccess: mocks.getPresentationForPortalAccess,
}));

import { loadPortalHomeCarePlan } from "./portal-home-care-plan";

const access = {
  membershipId: "membership-1",
  homeownerId: "homeowner-1",
  propertyId: "property-1",
  memberName: "Alex Kim",
  homeownerSlug: "alex-kim",
  propertySlug: "oak-house",
  portalAccessToken: "opaque-token",
};

const existingPlan: HomeCarePlanData = {
  ...canyonOaksHomeCarePlan,
  homeowner: {
    ...canyonOaksHomeCarePlan.homeowner,
    slug: access.homeownerSlug,
  },
  property: {
    ...canyonOaksHomeCarePlan.property,
    slug: access.propertySlug,
  },
};

function queue(
  table: string,
  ...results: Array<{ data: unknown; error?: { message: string } | null }>
) {
  mocks.results[table] = results.map((result) => ({
    data: result.data,
    error: result.error ?? null,
  }));
}

function existingRow(
  status: "draft" | "generated" | "published" | "archived",
  plan: HomeCarePlanData = existingPlan,
) {
  return {
    status,
    presentation: plan,
    homeowner_slug: access.homeownerSlug,
    property_slug: access.propertySlug,
  };
}

function queueBackfillContext(membershipPatch: Record<string, unknown> = {}) {
  queue("homeowners", {
    data: {
      id: access.homeownerId,
      slug: access.homeownerSlug,
      full_name: access.memberName,
    },
  });
  queue("properties", {
    data: {
      id: access.propertyId,
      homeowner_id: access.homeownerId,
      slug: access.propertySlug,
      name: "Oak House",
      address: "123 Oak Way",
      city: "Chico",
      state: "CA",
      square_feet: 2400,
    },
  });
  queue("memberships", {
    data: {
      id: access.membershipId,
      homeowner_id: access.homeownerId,
      property_id: access.propertyId,
      plan_name: "Quarterly Care",
      sales_tier: "quarterly",
      visit_price: 285,
      presentation_id: null,
      ...membershipPatch,
    },
  });
}

describe("token portal Home Care Plan authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const table of Object.keys(mocks.results)) {
      delete mocks.results[table];
    }
    mocks.eqCalls.length = 0;
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it.each(["archived", "draft"] as const)(
    "never rewrites an existing %s row",
    async (status) => {
      queue("home_care_plans", { data: existingRow(status) });

      await expect(loadPortalHomeCarePlan(access)).resolves.toBeNull();
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.client.from).not.toHaveBeenCalledWith("homeowners");
    },
  );

  it("does not turn an existing-row SELECT error into a backfill write", async () => {
    queue("home_care_plans", {
      data: null,
      error: { message: "permission denied" },
    });

    await expect(loadPortalHomeCarePlan(access)).rejects.toThrow(
      "Failed to load portal Home Care Plan: permission denied",
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.client.from).not.toHaveBeenCalledWith("homeowners");
  });

  it("fails closed on stale stored slugs without creating a replacement", async () => {
    queue("home_care_plans", {
      data: {
        ...existingRow("generated"),
        homeowner_slug: "stale-homeowner-slug",
      },
    });

    await expect(loadPortalHomeCarePlan(access)).resolves.toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("converges a missing-row race on the persisted winner without replacement", async () => {
    const winner: HomeCarePlanData = {
      ...existingPlan,
      hero: { ...existingPlan.hero, title: "Persisted winner" },
    };
    queue(
      "home_care_plans",
      { data: null },
      { data: existingRow("generated", winner) },
    );
    queueBackfillContext();

    await expect(loadPortalHomeCarePlan(access)).resolves.toBe(winner);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        homeowner_id: access.homeownerId,
        property_id: access.propertyId,
        status: "generated",
      }),
      {
        onConflict: "homeowner_slug,property_slug",
        ignoreDuplicates: true,
      },
    );
  });

  it("rejects cross-membership backfill context before writing", async () => {
    queue("home_care_plans", { data: null });
    queueBackfillContext({ id: "membership-2" });

    await expect(loadPortalHomeCarePlan(access)).resolves.toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["memberships", "id", access.membershipId],
        ["memberships", "homeowner_id", access.homeownerId],
        ["memberships", "property_id", access.propertyId],
      ]),
    );
  });
});
