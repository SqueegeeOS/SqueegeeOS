import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePortalAccessByToken: vi.fn(),
  loadPortalHomeCarePlan: vi.fn(),
  getMemberPortalDataByAccess: vi.fn(),
  getLatestCustomerHealthUnified: vi.fn(),
}));

vi.mock("@/lib/persistence/queries/portal-access", () => ({
  resolvePortalAccessByToken: mocks.resolvePortalAccessByToken,
}));

vi.mock("@/lib/membership/portal-home-care-plan", () => ({
  loadPortalHomeCarePlan: mocks.loadPortalHomeCarePlan,
}));

vi.mock("@/lib/persistence/queries/member-portal", () => ({
  getMemberPortalDataByAccess: mocks.getMemberPortalDataByAccess,
}));

vi.mock("@/lib/health/assessment-repository", () => ({
  getLatestCustomerHealthUnified: mocks.getLatestCustomerHealthUnified,
}));

import {
  loadMemberPortalPageBySlugs,
  loadMemberPortalPageByToken,
} from "./load-member-portal-page";

describe("member portal route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails the legacy slug route before every privileged plan/member/health read", async () => {
    await expect(
      loadMemberPortalPageBySlugs("alex", "oak-house"),
    ).resolves.toBeNull();
    expect(mocks.loadPortalHomeCarePlan).not.toHaveBeenCalled();
    expect(mocks.getMemberPortalDataByAccess).not.toHaveBeenCalled();
    expect(mocks.getLatestCustomerHealthUnified).not.toHaveBeenCalled();
  });

  it("keeps the token portal working after token resolution succeeds", async () => {
    const access = {
      membershipId: "membership-1",
      homeownerId: "homeowner-1",
      propertyId: "property-1",
      memberName: "Alex Kim",
      homeownerSlug: "alex",
      propertySlug: "oak-house",
      portalAccessToken: "opaque-portal-token",
    };
    const planData = { homeowner: { slug: "alex" } };
    const portalData = {
      membershipId: "membership-1",
      profile: { id: "profile-1" },
      property: { id: "property-1" },
    };
    const homeHealth = { visitDate: "2026-07-18" };
    mocks.resolvePortalAccessByToken.mockResolvedValue(access);
    mocks.loadPortalHomeCarePlan.mockResolvedValue(planData);
    mocks.getMemberPortalDataByAccess.mockResolvedValue(portalData);
    mocks.getLatestCustomerHealthUnified.mockResolvedValue(homeHealth);

    await expect(
      loadMemberPortalPageByToken("opaque-portal-token"),
    ).resolves.toMatchObject({
      planData,
      portalData,
      homeownerSlug: "alex",
      propertySlug: "oak-house",
      membershipId: "membership-1",
      homeownerId: "homeowner-1",
      propertyId: "property-1",
      homeHealth,
      homeHealthHref: "/portal/opaque-portal-token/home-health",
      portalBasePath: "/portal/opaque-portal-token",
      customerPortalMode: "token",
    });
    expect(mocks.loadPortalHomeCarePlan).toHaveBeenCalledWith(access);
    expect(mocks.getMemberPortalDataByAccess).toHaveBeenCalledWith(access);
    expect(mocks.getLatestCustomerHealthUnified).toHaveBeenCalledWith(
      "property-1",
    );
  });

  it.each([
    ["another-membership", "property-1"],
    ["membership-1", "another-property"],
  ])(
    "fails closed when member data resolves outside the token identity (%s, %s)",
    async (membershipId, propertyId) => {
      const access = {
        membershipId: "membership-1",
        homeownerId: "homeowner-1",
        propertyId: "property-1",
        memberName: "Alex Kim",
        homeownerSlug: "alex",
        propertySlug: "oak-house",
        portalAccessToken: "opaque-portal-token",
      };
      mocks.resolvePortalAccessByToken.mockResolvedValue(access);
      mocks.loadPortalHomeCarePlan.mockResolvedValue({
        homeowner: { slug: "alex" },
      });
      mocks.getMemberPortalDataByAccess.mockResolvedValue({
        membershipId,
        property: { id: propertyId },
      });

      await expect(
        loadMemberPortalPageByToken("opaque-portal-token"),
      ).resolves.toBeNull();
      expect(mocks.getLatestCustomerHealthUnified).not.toHaveBeenCalled();
    },
  );

  it("performs no downstream reads when the token is invalid", async () => {
    mocks.resolvePortalAccessByToken.mockResolvedValue(null);

    await expect(loadMemberPortalPageByToken("invalid")).resolves.toBeNull();
    expect(mocks.loadPortalHomeCarePlan).not.toHaveBeenCalled();
    expect(mocks.getMemberPortalDataByAccess).not.toHaveBeenCalled();
  });
});
