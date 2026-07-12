import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePortalAccessByToken: vi.fn(),
  getMemberReferralSummary: vi.fn(),
}));

vi.mock("@/lib/persistence/queries/portal-access", () => ({
  resolvePortalAccessByToken: mocks.resolvePortalAccessByToken,
}));

vi.mock("@/lib/referrals/repository", () => ({
  getMemberReferralSummary: mocks.getMemberReferralSummary,
}));

import { POST } from "@/app/api/referrals/portal/route";

function request(body: unknown): Request {
  return new Request("https://care.example.com/api/referrals/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("portal referral authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a portal token", async () => {
    const response = await POST(request({ membershipId: "enumerable-id" }));

    expect(response.status).toBe(400);
    expect(mocks.resolvePortalAccessByToken).not.toHaveBeenCalled();
  });

  it("rejects an unknown portal token", async () => {
    mocks.resolvePortalAccessByToken.mockResolvedValue(null);

    const response = await POST(request({ portalToken: "unknown" }));

    expect(response.status).toBe(401);
    expect(mocks.getMemberReferralSummary).not.toHaveBeenCalled();
  });

  it("derives member identity from the authorized portal token", async () => {
    mocks.resolvePortalAccessByToken.mockResolvedValue({
      membershipId: "membership-1",
      memberName: "Sylvia Example",
      homeownerSlug: "sylvia-example",
      propertySlug: "home",
      portalAccessToken: "valid-token",
    });
    mocks.getMemberReferralSummary.mockResolvedValue({ code: "SKTEST" });

    const response = await POST(
      request({
        portalToken: "valid-token",
        membershipId: "another-membership",
        memberName: "Spoofed Name",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getMemberReferralSummary).toHaveBeenCalledWith(
      "membership-1",
      "Sylvia Example",
      "https://care.example.com",
    );
  });
});
