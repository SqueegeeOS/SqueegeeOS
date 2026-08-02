import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePortalAccessByToken: vi.fn(),
  loadMemberPortalPageByToken: vi.fn(),
  finishTiming: vi.fn(),
}));

vi.mock("@/lib/persistence/queries/portal-access", () => ({
  resolvePortalAccessByToken: mocks.resolvePortalAccessByToken,
}));

vi.mock("@/lib/membership/load-member-portal-page", () => ({
  loadMemberPortalPageByToken: mocks.loadMemberPortalPageByToken,
}));

vi.mock("@/lib/observability/portal-timing", () => ({
  startPortalTiming: () => ({ finish: mocks.finishTiming }),
}));

import { GET } from "@/app/api/portal-manifest/[token]/route";

describe("token portal manifest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates access without loading the full portal", async () => {
    const token = "opaque_token_123";
    mocks.resolvePortalAccessByToken.mockResolvedValue({
      membershipId: "membership-1",
      memberName: "Member",
      homeownerSlug: "member",
      propertySlug: "property",
      portalAccessToken: token,
    });

    const response = await GET(new Request("https://care.example.com"), {
      params: Promise.resolve({ token }),
    });
    const body = await response.json();

    expect(body.start_url).toBe(`/portal/${token}`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.resolvePortalAccessByToken).toHaveBeenCalledWith(token);
    expect(mocks.loadMemberPortalPageByToken).not.toHaveBeenCalled();
  });

  it("returns the generic manifest for invalid tokens without querying", async () => {
    const response = await GET(new Request("https://care.example.com"), {
      params: Promise.resolve({ token: "bad" }),
    });
    const body = await response.json();

    expect(body.start_url).toBe("/portal");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.resolvePortalAccessByToken).not.toHaveBeenCalled();
    expect(mocks.loadMemberPortalPageByToken).not.toHaveBeenCalled();
  });
});
