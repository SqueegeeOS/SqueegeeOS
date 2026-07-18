import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getToken: vi.fn(),
  searchClients: vi.fn(),
  listProperties: vi.fn(),
  loadCandidates: vi.fn(),
  linkSearchedProperty: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/jobber-connection-store", () => ({
  getFreshJobberAccessToken: mocks.getToken,
}));
vi.mock(
  "@/lib/care-operations/jobber-client-search-provider",
  async () => {
    const actual = await vi.importActual<
      typeof import("./jobber-client-search-provider")
    >("./jobber-client-search-provider");
    return {
      ...actual,
      searchJobberClients: mocks.searchClients,
      listJobberClientProperties: mocks.listProperties,
    };
  },
);
vi.mock("@/lib/care-operations/jobber-property-matching", async () => {
  const actual = await vi.importActual<
    typeof import("./jobber-property-matching")
  >("./jobber-property-matching");
  return {
    ...actual,
    loadActiveMemberPropertyCandidates: mocks.loadCandidates,
    linkSearchedJobberClientProperty: mocks.linkSearchedProperty,
  };
});

import { POST as SEARCH } from "../../app/api/admin/care-operations/jobber/clients/search/route";
import { POST as PROPERTIES } from "../../app/api/admin/care-operations/jobber/clients/properties/route";
import { POST as LINK } from "../../app/api/admin/care-operations/jobber/property-links/route";

const actor = {
  id: "00000000-0000-4000-8000-000000000343",
  email: "operator@example.invalid",
  role: "operator" as const,
};

function request(path: string, body: Record<string, unknown>) {
  return new Request(`https://homeatlas.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Jobber member-search routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ actor });
    mocks.getToken.mockResolvedValue("access-token");
  });

  it.each([401, 403])(
    "returns auth %i before customer-search provider work",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json({ error: "boundary" }, { status }),
      });
      const response = await SEARCH(
        request(
          "/api/admin/care-operations/jobber/clients/search",
          { query: "member" },
        ),
      );
      expect(response.status).toBe(status);
      expect(mocks.getToken).not.toHaveBeenCalled();
      expect(mocks.searchClients).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])(
    "returns auth %i before client-property or membership reads",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json({ error: "boundary" }, { status }),
      });
      const response = await PROPERTIES(
        request(
          "/api/admin/care-operations/jobber/clients/properties",
          { clientId: "client-1" },
        ),
      );
      expect(response.status).toBe(status);
      expect(mocks.listProperties).not.toHaveBeenCalled();
      expect(mocks.loadCandidates).not.toHaveBeenCalled();
    },
  );

  it("keeps successful customer search private, uncached, and body-based", async () => {
    mocks.searchClients.mockResolvedValue({
      clients: [],
      resultLimitReached: false,
      clientCoverageLimitReached: false,
      clientsScanned: 205,
      pagesScanned: 3,
    });
    const response = await SEARCH(
      request(
        "/api/admin/care-operations/jobber/clients/search",
        { query: "private customer term" },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.searchClients).toHaveBeenCalledWith(
      "access-token",
      "private customer term",
    );
  });

  it("returns exact properties and active-member candidates without caching", async () => {
    mocks.listProperties.mockResolvedValue({
      properties: [
        {
          id: "property-1",
          jobberWebUri: "https://secure.getjobber.com/properties/1",
        },
      ],
      propertyCoverageLimitReached: false,
      pagesScanned: 1,
    });
    mocks.loadCandidates.mockResolvedValue({
      activeMemberProperties: [],
      candidateLimitReached: false,
    });
    const response = await PROPERTIES(
      request(
        "/api/admin/care-operations/jobber/clients/properties",
        { clientId: "client-1" },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      properties: [{ id: "property-1" }],
      activeMemberProperties: [],
    });
  });

  it("uses the authenticated actor and ignores browser URI or actor claims", async () => {
    mocks.linkSearchedProperty.mockResolvedValue("linked");
    const response = await LINK(
      request(
        "/api/admin/care-operations/jobber/property-links",
        {
          action: "link_client_property",
          clientId: "client-1",
          externalPropertyId: "property-1",
          membershipId: "00000000-0000-4000-8000-000000000341",
          samePhysicalPropertyConfirmed: true,
          actorId: "browser-actor",
          jobberWebUri: "https://attacker.invalid/property",
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.linkSearchedProperty).toHaveBeenCalledWith({
      clientId: "client-1",
      externalPropertyId: "property-1",
      membershipId: "00000000-0000-4000-8000-000000000341",
      actorId: actor.id,
      samePhysicalPropertyConfirmed: true,
    });
  });
});
