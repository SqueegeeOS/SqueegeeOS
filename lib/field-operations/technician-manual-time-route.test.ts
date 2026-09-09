import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/admin/server-auth", () => ({
  authorizeAdminRequest: mocks.authorize,
}));
vi.mock("@/lib/field-operations/technician-manual-time-server", () => ({
  recordTechnicianManualTime: mocks.record,
}));

import { POST } from "@/app/api/admin/technicians/[technicianId]/time-entries/route";
import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

function request(body: Record<string, unknown>) {
  return new Request("https://www.squeegeeking.net/api/admin/technicians/tyler/time-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(technicianId = TYLER_GERMANY_TECHNICIAN_ID) {
  return { params: Promise.resolve({ technicianId }) };
}

describe("technician owner-entered time endpoint", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.record.mockReset();
  });

  it("fails closed without HQ authorization", async () => {
    mocks.authorize.mockReturnValue(false);
    const response = await POST(request({}), context());
    expect(response.status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects malformed technician ids before any write", async () => {
    mocks.authorize.mockReturnValue(true);
    const response = await POST(request({}), context("not-a-tech"));
    expect(response.status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("records a separate audited owner time source", async () => {
    mocks.authorize.mockReturnValue(true);
    mocks.record.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      startedAt: "2026-09-08T16:00:00.000Z",
      endedAt: "2026-09-08T18:00:00.000Z",
      minutes: 120,
    });
    const response = await POST(
      request({
        workDate: "2026-09-08",
        startTime: "09:00",
        endTime: "11:00",
        reason: "pre_atlas",
        note: "Verified by owner from pre-Atlas workday.",
      }),
      context(),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        technicianId: TYLER_GERMANY_TECHNICIAN_ID,
        workDate: "2026-09-08",
        reason: "pre_atlas",
      }),
    );
  });
});
