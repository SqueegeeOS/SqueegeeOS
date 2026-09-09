import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/lib/admin/server-auth", () => ({
  authorizeAdminRequest: mocks.authorize,
}));
vi.mock("@/lib/field-operations/technician-profile-server", () => ({
  loadTechnicianOperationalProfile: mocks.load,
}));

import { GET } from "@/app/api/admin/technicians/[technicianId]/profile/route";
import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

function request() {
  return new Request(
    `https://www.squeegeeking.net/api/admin/technicians/${TYLER_GERMANY_TECHNICIAN_ID}/profile`,
  );
}

function context(technicianId = TYLER_GERMANY_TECHNICIAN_ID) {
  return { params: Promise.resolve({ technicianId }) };
}

describe("private technician profile endpoint", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.load.mockReset();
  });

  it("fails closed without founder authorization", async () => {
    mocks.authorize.mockReturnValue(false);
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("rejects malformed technician identifiers before loading data", async () => {
    mocks.authorize.mockReturnValue(true);
    const response = await GET(request(), context("not-a-technician"));
    expect(response.status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("returns not found for a valid but unknown HomeAtlas technician", async () => {
    mocks.authorize.mockReturnValue(true);
    mocks.load.mockResolvedValue(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
  });

  it("returns private operational data for an authorized technician profile", async () => {
    mocks.authorize.mockReturnValue(true);
    mocks.load.mockResolvedValue({
      generatedAt: "2026-09-08T20:00:00.000Z",
      technician: { id: TYLER_GERMANY_TECHNICIAN_ID, displayName: "Tyler Germany" },
    });
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.profile.technician.displayName).toBe("Tyler Germany");
    expect(mocks.load).toHaveBeenCalledWith(TYLER_GERMANY_TECHNICIAN_ID);
  });
});
