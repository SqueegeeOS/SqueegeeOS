import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPortalHomeCarePlan: vi.fn(),
  getMemberPortalDataBySlugs: vi.fn(),
  getPropertyIdBySlugs: vi.fn(),
  getLatestCustomerHealthUnified: vi.fn(),
  finishTiming: vi.fn(),
}));

vi.mock("@/lib/membership/portal-home-care-plan", () => ({
  loadPortalHomeCarePlan: mocks.loadPortalHomeCarePlan,
}));

vi.mock("@/lib/persistence/queries/member-portal", () => ({
  getMemberPortalDataBySlugs: mocks.getMemberPortalDataBySlugs,
}));

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/health/repository", () => ({
  getPropertyIdBySlugs: mocks.getPropertyIdBySlugs,
}));

vi.mock("@/lib/health/assessment-repository", () => ({
  getLatestCustomerHealthUnified: mocks.getLatestCustomerHealthUnified,
}));

vi.mock("@/lib/observability/portal-timing", () => ({
  startPortalTiming: () => ({ finish: mocks.finishTiming }),
}));

import { loadMemberPortalPageBySlugs } from "./load-member-portal-page";

describe("member portal page loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPortalHomeCarePlan.mockResolvedValue({ id: "plan" });
    mocks.getMemberPortalDataBySlugs.mockResolvedValue({ id: "portal-data" });
  });

  it("does not load dedicated home-health data on the main portal path", async () => {
    const model = await loadMemberPortalPageBySlugs("member", "property");

    expect(model).not.toBeNull();
    expect(model).not.toHaveProperty("homeHealth");
    expect(model).not.toHaveProperty("homeHealthHref");
    expect(mocks.getPropertyIdBySlugs).not.toHaveBeenCalled();
    expect(mocks.getLatestCustomerHealthUnified).not.toHaveBeenCalled();
  });

  it("starts independent plan and portal reads concurrently", async () => {
    let releasePlan: ((value: { id: string }) => void) | undefined;
    mocks.loadPortalHomeCarePlan.mockReturnValue(
      new Promise((resolve) => {
        releasePlan = resolve;
      }),
    );

    const result = loadMemberPortalPageBySlugs("member", "property");
    await vi.waitFor(() => {
      expect(mocks.getMemberPortalDataBySlugs).toHaveBeenCalledWith(
        "member",
        "property",
      );
    });

    releasePlan?.({ id: "plan" });
    await expect(result).resolves.toMatchObject({
      planData: { id: "plan" },
      portalData: { id: "portal-data" },
    });
  });
});
