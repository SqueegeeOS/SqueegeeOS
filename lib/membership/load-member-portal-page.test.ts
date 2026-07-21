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
});
