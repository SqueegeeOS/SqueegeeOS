import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePortalAccessByToken: vi.fn(),
  listPortalServiceCases: vi.fn(),
  createPortalServiceCase: vi.fn(),
}));

vi.mock("@/lib/persistence/queries/portal-access", () => ({
  resolvePortalAccessByToken: mocks.resolvePortalAccessByToken,
}));

vi.mock("@/lib/service-cases/customer-service-case-actions-server", () => ({
  CustomerServiceCaseActionError: class extends Error {},
  listPortalServiceCases: mocks.listPortalServiceCases,
  createPortalServiceCase: mocks.createPortalServiceCase,
}));

import { GET, POST } from "@/app/api/portal/service-cases/route";

const access = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  homeownerId: "22222222-2222-4222-8222-222222222222",
  propertyId: "33333333-3333-4333-8333-333333333333",
  memberName: "Mandi Rivera",
  homeownerSlug: "mandi-rivera",
  propertySlug: "davis-street",
  portalAccessToken: "portal-secret",
};

function request(method: "GET" | "POST", body?: unknown, token?: string) {
  const headers = new Headers();
  if (token) headers.set("x-portal-token", token);
  if (body) headers.set("Content-Type", "application/json");
  return new Request("https://care.example.com/api/portal/service-cases", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("portal service case authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a read without a token and remains private", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.listPortalServiceCases).not.toHaveBeenCalled();
  });

  it("derives all customer identity from the portal token", async () => {
    mocks.resolvePortalAccessByToken.mockResolvedValue(access);
    mocks.createPortalServiceCase.mockResolvedValue({
      serviceCase: { id: "case-1" },
      duplicate: false,
    });

    const response = await POST(
      request(
        "POST",
        {
          clientRequestId: "44444444-4444-4444-8444-444444444444",
          category: "service_quality",
          details: "The lower window still has visible spotting.",
          membershipId: "spoofed-membership",
          homeownerId: "spoofed-homeowner",
          propertyId: "spoofed-property",
        },
        "portal-secret",
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.createPortalServiceCase).toHaveBeenCalledWith({
      access,
      clientRequestId: "44444444-4444-4444-8444-444444444444",
      category: "service_quality",
      appointmentId: undefined,
      details: "The lower window still has visible spotting.",
    });
  });

  it("does not accept a body token as portal authority", async () => {
    const response = await POST(
      request("POST", {
        portalToken: "portal-secret",
        details: "This token is in the wrong place.",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.resolvePortalAccessByToken).not.toHaveBeenCalled();
  });
});
