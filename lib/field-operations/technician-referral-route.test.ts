import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeFieldRequest: vi.fn(),
  createLeadIntake: vi.fn(),
  routeInboundLeadToConfiguredOwner: vi.fn(),
  sendLeadNotificationEmail: vi.fn(),
}));

vi.mock("@/lib/field-operations/field-access", () => ({
  authorizeFieldRequest: mocks.authorizeFieldRequest,
}));
vi.mock("@/lib/acquisition/leads/repository", () => ({
  createLeadIntake: mocks.createLeadIntake,
}));
vi.mock("@/lib/sales/inbound-lead-routing-server", () => ({
  routeInboundLeadToConfiguredOwner: mocks.routeInboundLeadToConfiguredOwner,
}));
vi.mock("@/lib/acquisition/send-lead-notification-email", () => ({
  sendLeadNotificationEmail: mocks.sendLeadNotificationEmail,
}));

import { POST } from "@/app/api/field/referrals/route";

const SUBMISSION_ID = "00000000-0000-4000-8000-000000000091";

function request(body: Record<string, unknown>): Request {
  return new Request("https://www.squeegeeking.net/api/field/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const body = {
  submissionId: SUBMISSION_ID,
  name: "Warm Neighbor",
  phone: "530-555-0191",
  email: "",
  serviceAddress: "Chico, CA",
  servicesInterested: ["Window Cleaning"],
  notes: "Met near the route.",
  permissionConfirmed: true,
};

describe("technician referral intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeFieldRequest.mockResolvedValue({
      kind: "technician",
      role: "technician",
      grantId: "11111111-1111-4111-8111-111111111111",
      jobberUserId: "homeatlas:22222222-2222-4222-8222-222222222222",
      displayName: "Tyler Germany",
      sessionExpiresAt: "2027-09-01T00:00:00.000Z",
    });
    mocks.createLeadIntake.mockImplementation(async (input) => ({
      record: {
        ...input,
        id: "33333333-3333-4333-8333-333333333333",
        status: "new",
        submittedAt: "2026-09-03T20:00:00.000Z",
      },
      storage: "supabase",
      duplicate: false,
    }));
    mocks.routeInboundLeadToConfiguredOwner.mockResolvedValue({ status: "assigned" });
    mocks.sendLeadNotificationEmail.mockResolvedValue({ sent: true });
  });

  it("stamps attribution from the authenticated technician and never messages the customer", async () => {
    const response = await POST(request({
      ...body,
      referredByTechnicianName: "Forged name",
    }));
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(responseBody).toMatchObject({
      creditedTo: "Tyler Germany",
      customerMessageSent: false,
    });
    expect(mocks.createLeadIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "technician_referral",
        referredByTechnicianName: "Tyler Germany",
        referredByTechnicianKey: "homeatlas:22222222-2222-4222-8222-222222222222",
        smsConsentStatus: "unknown",
      }),
    );
    expect(mocks.routeInboundLeadToConfiguredOwner).toHaveBeenCalledTimes(1);
    expect(mocks.sendLeadNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects referrals without the contact permission attestation", async () => {
    const response = await POST(request({ ...body, permissionConfirmed: false }));

    expect(response.status).toBe(400);
    expect(mocks.createLeadIntake).not.toHaveBeenCalled();
  });

  it("rejects owner preview sessions from the field write route", async () => {
    mocks.authorizeFieldRequest.mockResolvedValue({
      kind: "admin",
      displayName: "HomeAtlas HQ",
      grantId: null,
      jobberUserId: null,
    });

    const response = await POST(request(body));

    expect(response.status).toBe(401);
    expect(mocks.createLeadIntake).not.toHaveBeenCalled();
  });
});
