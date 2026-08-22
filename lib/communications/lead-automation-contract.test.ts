import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./lead-automation.ts", import.meta.url),
  "utf8",
);

describe("lead communication automation contract", () => {
  it("executes both enabled email and consented SMS paths", () => {
    expect(source).toContain("buildLeadAcknowledgementEmailPlan");
    expect(source).toContain("buildLeadFirstTouchSmsPlan");
    expect(source).toContain('loadAutomationRule("lead_acknowledgement", "sms")');
    expect(source).toContain("allowUnverifiedSms");
    expect(source).toContain("emailDuplicate");
    expect(source).toContain("smsDuplicate");
  });

  it("queues quiet-hour SMS for the authenticated daily processor", () => {
    expect(source).toContain("scheduleOutboundCommunication");
    expect(source).toContain("scheduledFor: smsPlan.notBefore");
    expect(source).toContain('verificationOverride: "lead_form_explicit_consent"');
  });
});
