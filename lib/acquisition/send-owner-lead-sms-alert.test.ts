import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadIntakeRecord } from "./lead-record";

const mocks = vi.hoisted(() => ({
  readiness: vi.fn(),
  configuration: vi.fn(),
  send: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/communications/provider-readiness", () => ({
  getCommunicationAutomationReadiness: mocks.readiness,
}));
vi.mock("@/lib/communications/service", () => ({
  getCommunicationsConfiguration: mocks.configuration,
}));
vi.mock("@/lib/communications/providers/twilio-sms", () => ({
  sendTwilioSms: mocks.send,
}));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({
    from: () => ({ update: mocks.update }),
  }),
}));

import { sendWebsiteLeadSmsAlert } from "./send-owner-lead-sms-alert";

// No text consent on this customer: the recipient is the consenting owner.
const lead = { id: "lead-1", source: "request_form", phone: "+15305550123", smsConsentStatus: "unknown" } as LeadIntakeRecord;

describe("website owner SMS alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readiness.mockResolvedValue({ ready: true, reason: null });
    mocks.configuration.mockReturnValue({ sms: { configured: true } });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ or: mocks.or });
    mocks.or.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: lead.id }, error: null });
    mocks.send.mockResolvedValue({ ok: true, providerMessageId: "SMtest" });
  });

  it("sends the exact requested message to Noah and records Twilio acceptance", async () => {
    await expect(sendWebsiteLeadSmsAlert(lead)).resolves.toEqual({ sent: true });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({
      to: "+15305886235",
      body: "You Got an Organic Hot Lead on your Website!🔥",
    });
    expect(mocks.update).toHaveBeenLastCalledWith({
      owner_sms_alert_status: "accepted",
      owner_sms_alert_provider_id: "SMtest",
      owner_sms_alert_failure_code: null,
    });
  });

  it("does not resend an already claimed lead", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await sendWebsiteLeadSmsAlert(lead);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send if the durable claim fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(sendWebsiteLeadSmsAlert(lead)).resolves.toMatchObject({ sent: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("records a rejected Twilio send for diagnosis", async () => {
    mocks.send.mockResolvedValue({ ok: false, errorCode: "rate_limited" });
    await expect(sendWebsiteLeadSmsAlert(lead)).resolves.toEqual({ sent: false, reason: "rate_limited" });
    expect(mocks.update).toHaveBeenLastCalledWith({
      owner_sms_alert_status: "failed",
      owner_sms_alert_provider_id: null,
      owner_sms_alert_failure_code: "rate_limited",
    });
  });

  it("requires approved sender configuration", async () => {
    mocks.configuration.mockReturnValue({ sms: { configured: false } });
    await expect(sendWebsiteLeadSmsAlert(lead)).resolves.toMatchObject({ sent: false });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires verified callbacks for the current Twilio token", async () => {
    mocks.readiness.mockResolvedValue({ ready: false, reason: "current_webhook_secret_not_verified" });
    await expect(sendWebsiteLeadSmsAlert(lead)).resolves.toMatchObject({ sent: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["facebook_lead_ad", "technician_referral"])("does not label a %s as an organic website lead", async (source) => {
    await sendWebsiteLeadSmsAlert({ ...lead, source } as LeadIntakeRecord);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
  });
});
