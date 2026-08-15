import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inboxSource = readFileSync(
  new URL("../../components/admin/communications-inbox-page.tsx", import.meta.url),
  "utf8",
);
const environmentExample = readFileSync(
  new URL("../../.env.example", import.meta.url),
  "utf8",
);

describe("communications owner UI contract", () => {
  it("distinguishes two-way text from outbound email", () => {
    expect(inboxSource).toContain("two-way text");
    expect(inboxSource).toContain("incoming text replies");
    expect(inboxSource).toContain(
      "Customer email replies go to your monitored reply-to",
    );
    expect(inboxSource).not.toContain("Replies return to this timeline.");
    expect(inboxSource).toContain("Finish text setup");
    expect(inboxSource).toContain("CommunicationsLaunchReadinessPanel");
    expect(inboxSource).toContain(
      "https://www.squeegeeking.net/api/integrations/twilio/inbound",
    );
    expect(inboxSource).toContain(
      "https://www.squeegeeking.net/api/integrations/twilio/status",
    );
    expect(inboxSource).toMatch(
      /Adding\s+or editing a phone number never opts someone into texts\./,
    );
    expect(inboxSource).toContain("Record explicit permission");
    expect(inboxSource).toContain("Stop texts now");
  });

  it("documents every server-side provider setting and webhook", () => {
    for (const setting of [
      "RESEND_API_KEY",
      "RESEND_COMMUNICATIONS_FROM",
      "RESEND_COMMUNICATIONS_REPLY_TO",
      "RESEND_WEBHOOK_SECRET",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_NUMBER",
      "TWILIO_MESSAGING_SERVICE_SID",
      "TWILIO_SENDER_APPROVED",
      "TWILIO_STATUS_CALLBACK_URL",
      "META_WEBHOOK_VERIFY_TOKEN",
      "META_APP_SECRET",
      "META_PAGE_ACCESS_TOKEN",
      "META_GRAPH_API_VERSION",
    ]) {
      expect(environmentExample).toContain(setting);
    }
    expect(environmentExample).toContain("/api/integrations/resend/webhook");
    expect(environmentExample).toContain("/api/integrations/twilio/status");
    expect(environmentExample).toContain("/api/integrations/twilio/inbound");
    expect(environmentExample).toContain("/api/integrations/meta/leads");
  });
});
