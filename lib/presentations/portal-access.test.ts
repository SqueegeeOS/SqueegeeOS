import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = maybeSingle;

  return {
    cloudConnected: vi.fn(() => true),
    client: { from: vi.fn(() => query) },
    maybeSingle,
    query,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: mocks.cloudConnected,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => mocks.client),
}));

import { getPresentationForPortalAccess } from "./repository";

describe("getPresentationForPortalAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cloudConnected.mockReturnValue(true);
  });

  it("binds the presentation read to all immutable portal IDs", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      getPresentationForPortalAccess("presentation-1", {
        membershipId: "membership-1",
        homeownerId: "homeowner-1",
        propertyId: "property-1",
      }),
    ).resolves.toBeNull();

    expect(mocks.query.eq).toHaveBeenNthCalledWith(1, "id", "presentation-1");
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      2,
      "membership_id",
      "membership-1",
    );
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      3,
      "homeowner_id",
      "homeowner-1",
    );
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      4,
      "property_id",
      "property-1",
    );
  });

  it("fails closed on a mismatched presentation", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      getPresentationForPortalAccess("cross-membership-presentation", {
        membershipId: "membership-1",
        homeownerId: "homeowner-1",
        propertyId: "property-1",
      }),
    ).resolves.toBeNull();
  });
});
