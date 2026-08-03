import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  new URL(
    "../../app/api/admin/communications/automation/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const inboundRoute = readFileSync(
  new URL("../../app/api/integrations/twilio/inbound/route.ts", import.meta.url),
  "utf8",
);
const resendRoute = readFileSync(
  new URL("../../app/api/integrations/resend/webhook/route.ts", import.meta.url),
  "utf8",
);

describe("communications automation control", () => {
  it("refuses to arm a rule until its provider is configured", () => {
    expect(route).toContain("getCommunicationsConfiguration");
    expect(route).toContain("configuration[channel].configured");
    expect(route).toContain("getCommunicationAutomationReadiness");
    expect(route).toContain("signed Twilio inbound or status-callback test");
    expect(route).toContain("status: 409");
  });

  it("binds provider readiness to a signed webhook for the current secret", () => {
    expect(service).toContain("RESEND_WEBHOOK_SECRET");
    expect(service).toContain("TWILIO_SENDER_APPROVED");
    expect(inboundRoute).toContain("recordCommunicationWebhookVerification");
    expect(resendRoute).toContain("recordCommunicationWebhookVerification");
    expect(service).toContain("assertCommunicationProviderReadiness");
    expect(service).toContain("getCommunicationAutomationReadiness");
  });

  it("rechecks current SMS consent immediately before a scheduled send", () => {
    expect(service).toContain("processDueScheduledCommunications");
    expect(service).toContain("loadCommunicationConversationContext");
    expect(service).toContain("evaluateOutboundCommunicationGate");
    expect(service).toContain("sms_consent_required");
    expect(service).toContain("scheduled_message_no_longer_applicable");
  });
});
