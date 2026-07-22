import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = maybeSingle;

  return {
    configured: vi.fn(() => true),
    client: { from: vi.fn(() => query) },
    maybeSingle,
    query,
  };
});

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => mocks.client),
  isSupabaseConfigured: mocks.configured,
}));

import { resolvePortalAccessByToken } from "./portal-access";

const authorizedRow = {
  id: "membership-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  portal_access_token: "opaque-token",
  homeowners: {
    id: "homeowner-1",
    slug: "alex-kim",
    full_name: "Alex Kim",
  },
  properties: {
    id: "property-1",
    homeowner_id: "homeowner-1",
    slug: "oak-house",
  },
};

describe("resolvePortalAccessByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
  });

  it("returns the immutable membership, homeowner, and property IDs", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: authorizedRow, error: null });

    await expect(resolvePortalAccessByToken(" opaque-token ")).resolves.toEqual({
      membershipId: "membership-1",
      homeownerId: "homeowner-1",
      propertyId: "property-1",
      memberName: "Alex Kim",
      homeownerSlug: "alex-kim",
      propertySlug: "oak-house",
      portalAccessToken: "opaque-token",
    });
    expect(mocks.query.eq).toHaveBeenCalledWith(
      "portal_access_token",
      "opaque-token",
    );
  });

  it.each([
    ["membership homeowner mismatch", { homeowner_id: "homeowner-2" }],
    ["membership property mismatch", { property_id: "property-2" }],
    [
      "property owner mismatch",
      {
        properties: {
          ...authorizedRow.properties,
          homeowner_id: "homeowner-2",
        },
      },
    ],
  ])("rejects %s", async (_label, patch) => {
    mocks.maybeSingle.mockResolvedValue({
      data: { ...authorizedRow, ...patch },
      error: null,
    });

    await expect(resolvePortalAccessByToken("opaque-token")).resolves.toBeNull();
  });

  it("fails closed on token SELECT errors", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: authorizedRow,
      error: { message: "permission denied" },
    });

    await expect(resolvePortalAccessByToken("opaque-token")).resolves.toBeNull();
  });
});
