import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  setVisibility: vi.fn(),
}));

vi.mock("@/lib/admin/server-auth", () => ({
  authorizeAdminRequest: mocks.authorize,
}));
vi.mock("@/lib/field-records/technician-photo-memory-server", () => ({
  setTechnicianPhotoCustomerVisibility: mocks.setVisibility,
}));

import { POST } from "@/app/api/admin/technicians/[technicianId]/photos/[photoId]/visibility/route";
import { TYLER_GERMANY_TECHNICIAN_ID } from "@/lib/field-operations/technician-profile";

const PHOTO_ID = "11111111-1111-4111-8111-111111111111";

function request(customerVisible: boolean) {
  return new Request("https://www.squeegeeking.net/api/admin/technicians/tyler/photos/photo/visibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerVisible }),
  });
}

function context(technicianId = TYLER_GERMANY_TECHNICIAN_ID, photoId = PHOTO_ID) {
  return { params: Promise.resolve({ technicianId, photoId }) };
}

describe("technician photo publication endpoint", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.setVisibility.mockReset();
  });

  it("fails closed publicly", async () => {
    mocks.authorize.mockReturnValue(false);
    const response = await POST(request(true), context());
    expect(response.status).toBe(401);
    expect(mocks.setVisibility).not.toHaveBeenCalled();
  });

  it("publishes only through the server-side property-memory service", async () => {
    mocks.authorize.mockReturnValue(true);
    mocks.setVisibility.mockResolvedValue({ id: PHOTO_ID, customerVisible: true });
    const response = await POST(request(true), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.setVisibility).toHaveBeenCalledWith({
      technicianId: TYLER_GERMANY_TECHNICIAN_ID,
      photoId: PHOTO_ID,
      customerVisible: true,
    });
  });
});
