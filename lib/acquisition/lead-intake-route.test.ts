import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLeadIntake: vi.fn(),
  attachLeadToReferral: vi.fn(),
  cookies: vi.fn(),
  runLeadAcknowledgementAutomation: vi.fn(),
  sendLeadNotificationEmail: vi.fn(),
  routeInboundLeadToConfiguredOwner: vi.fn(),
}));

vi.mock("@/lib/acquisition/leads/repository", () => ({
  createLeadIntake: mocks.createLeadIntake,
}));

vi.mock("@/lib/referrals/repository", () => ({
  attachLeadToReferral: mocks.attachLeadToReferral,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/communications/lead-automation", () => ({
  runLeadAcknowledgementAutomation: mocks.runLeadAcknowledgementAutomation,
}));

vi.mock("@/lib/acquisition/send-lead-notification-email", () => ({
  sendLeadNotificationEmail: mocks.sendLeadNotificationEmail,
}));

vi.mock("@/lib/sales/inbound-lead-routing-server", () => ({
  routeInboundLeadToConfiguredOwner:
    mocks.routeInboundLeadToConfiguredOwner,
}));

import { POST } from "@/app/api/leads/route";

const SUBMISSION_ID = "00000000-0000-4000-8000-000000000081";
const LEAD_ID = "11111111-1111-4111-8111-111111111111";

const requestBody = {
  submissionId: SUBMISSION_ID,
  name: "Retry Safe Homeowner",
  phone: "530-555-0181",
  email: "safe@example.com",
  serviceAddress: "181 Safe Request Way, Chico, CA",
  servicesInterested: ["Window Cleaning"],
  preferredContactMethod: "Phone",
  smsConsent: false,
  notes: "",
  membershipTier: "quarterly",
  squareFootage: 2400,
  preferredStartWindow: "Within 2 weeks",
};

const savedRecord = {
  id: LEAD_ID,
  name: requestBody.name,
  phone: requestBody.phone,
  email: requestBody.email,
  serviceAddress: requestBody.serviceAddress,
  servicesInterested: requestBody.servicesInterested,
  preferredContactMethod: requestBody.preferredContactMethod,
  smsConsentStatus: "unknown",
  smsConsentRecordedAt: null,
  notes: "",
  membershipTier: "quarterly",
  squareFootage: 2400,
  estimatedVisitPrice: 249,
  preferredStartWindow: requestBody.preferredStartWindow,
  status: "new",
  submittedAt: "2026-08-16T20:00:00.000Z",
  source: "request_form",
  clientSubmissionId: SUBMISSION_ID,
  externalLeadId: null,
  sourcePageId: null,
  sourceFormId: null,
  sourceCampaignId: null,
  sourceCampaignName: null,
  sourceAdsetId: null,
  sourceAdsetName: null,
  sourceAdId: null,
  sourceAdName: null,
};

function request(body: unknown): Request {
  return new Request("https://www.squeegeeking.net/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("public lead intake retry safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
    mocks.createLeadIntake.mockResolvedValue({
      record: savedRecord,
      storage: "supabase",
      duplicate: false,
    });
    mocks.routeInboundLeadToConfiguredOwner.mockResolvedValue({
      status: "assigned",
    });
    mocks.runLeadAcknowledgementAutomation.mockResolvedValue({
      emailSent: true,
      smsSent: false,
      smsScheduled: false,
      reason: null,
      smsReason: "not_requested",
    });
    mocks.sendLeadNotificationEmail.mockResolvedValue({ sent: true });
  });

  it("requires a browser submission UUID before writing a lead", async () => {
    const response = await POST(request({ ...requestBody, submissionId: null }));

    expect(response.status).toBe(400);
    expect(mocks.createLeadIntake).not.toHaveBeenCalled();
  });

  it("returns the original lead and skips every post-save side effect on retry", async () => {
    mocks.createLeadIntake.mockResolvedValue({
      record: savedRecord,
      storage: "supabase",
      duplicate: true,
    });

    const response = await POST(request(requestBody));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: LEAD_ID,
      duplicate: true,
      emailSent: false,
      smsSent: false,
      notifySent: false,
    });
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.attachLeadToReferral).not.toHaveBeenCalled();
    expect(mocks.routeInboundLeadToConfiguredOwner).not.toHaveBeenCalled();
    expect(mocks.runLeadAcknowledgementAutomation).not.toHaveBeenCalled();
    expect(mocks.sendLeadNotificationEmail).not.toHaveBeenCalled();
  });

  it("saves and automates a fresh request exactly once", async () => {
    const response = await POST(request(requestBody));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(false);
    expect(mocks.createLeadIntake).toHaveBeenCalledWith(
      expect.objectContaining({ clientSubmissionId: SUBMISSION_ID }),
    );
    expect(mocks.routeInboundLeadToConfiguredOwner).toHaveBeenCalledTimes(1);
    expect(mocks.runLeadAcknowledgementAutomation).toHaveBeenCalledTimes(1);
    expect(mocks.sendLeadNotificationEmail).toHaveBeenCalledTimes(1);
  });
});
