import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.maybeSingle = maybeSingle;

  return {
    cloudConnected: vi.fn(() => true),
    createServiceClient: vi.fn(() => ({
      from: vi.fn(() => query),
    })),
    maybeSingle,
    query,
  };
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: mocks.cloudConnected,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: mocks.createServiceClient,
}));

import { loadHomeCarePlanPresentationByCapability } from "./load-home-care-plan";

const capability = "11111111-1111-4111-8111-111111111111";

describe("loadHomeCarePlanPresentationByCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cloudConnected.mockReturnValue(true);
  });

  it("returns only one exact presentation document through the service role", async () => {
    const presentation = { homeowner: { slug: "alex" } };
    mocks.maybeSingle.mockResolvedValue({
      data: { presentation },
      error: null,
    });

    await expect(
      loadHomeCarePlanPresentationByCapability(
        capability,
        "alex",
        "oak-house",
      ),
    ).resolves.toBe(presentation);
    expect(mocks.createServiceClient).toHaveBeenCalledOnce();
    expect(mocks.query.select).toHaveBeenCalledWith("presentation");
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      1,
      "id",
      capability,
    );
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      2,
      "homeowner_slug",
      "alex",
    );
    expect(mocks.query.eq).toHaveBeenNthCalledWith(
      3,
      "property_slug",
      "oak-house",
    );
    expect(mocks.query.in).toHaveBeenCalledWith("status", [
      "generated",
      "published",
    ]);
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });

  it("does not create a privileged client when cloud persistence is disabled", async () => {
    mocks.cloudConnected.mockReturnValue(false);

    await expect(
      loadHomeCarePlanPresentationByCapability(
        capability,
        "alex",
        "oak-house",
      ),
    ).resolves.toBeNull();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed UUID before creating a privileged client", async () => {
    await expect(
      loadHomeCarePlanPresentationByCapability(
        "guessable-plan",
        "alex",
        "oak-house",
      ),
    ).resolves.toBeNull();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("fails closed on a database read error", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      loadHomeCarePlanPresentationByCapability(
        capability,
        "alex",
        "oak-house",
      ),
    ).rejects.toThrow("Failed to load Home Care Plan presentation: permission denied");
  });
});
