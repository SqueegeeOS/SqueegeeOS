import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  customerMessageStatusForTwilio,
  existingContactPointUpdateForInboundSms,
  normalizeStoredUsPhoneToE164,
  resolveTwilioSignatureUrl,
} from "./twilio-communications";

const source = readFileSync(
  new URL("./twilio-communications.ts", import.meta.url),
  "utf8",
);

describe("Twilio communications helpers", () => {
  it("normalizes common stored US phone formats", () => {
    expect(normalizeStoredUsPhoneToE164("(530) 555-0101")).toBe("+15305550101");
    expect(normalizeStoredUsPhoneToE164("1-530-555-0101")).toBe("+15305550101");
    expect(normalizeStoredUsPhoneToE164("555-0101")).toBeNull();
  });

  it("maps Twilio statuses into the durable message ledger", () => {
    expect(customerMessageStatusForTwilio("delivered")).toBe("delivered");
    expect(customerMessageStatusForTwilio("undelivered")).toBe("failed");
    expect(customerMessageStatusForTwilio("canceled")).toBe("cancelled");
  });

  it("reconstructs the exact public webhook URL from trusted proxy headers", () => {
    const request = new Request("http://internal/api/integrations/twilio/inbound?x=1", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "www.squeegeeking.net",
      },
    });
    expect(resolveTwilioSignatureUrl(request)).toBe(
      "https://www.squeegeeking.net/api/integrations/twilio/inbound?x=1",
    );
  });

  it("fails closed when STOP or START persistence cannot be confirmed", () => {
    expect(source).toContain("contact_consent_update_failed");
    expect(source).toContain("lead_consent_update_failed");
    expect(source).toContain("webhook_event_finalize_failed");
  });

  it("verifies an existing unverified contact point when inbound START opts it in", () => {
    const verifiedAt = "2026-08-23T02:00:00.000Z";

    expect(
      existingContactPointUpdateForInboundSms("start", verifiedAt),
    ).toEqual({
      verification_status: "verified",
      verified_at: verifiedAt,
      consent_status: "opted_in",
      consent_source: "twilio_keyword",
      consent_recorded_at: verifiedAt,
      opt_out_reason: null,
    });
    expect(source).toContain('.eq("channel", "sms")');
    expect(source).toContain('.eq("address_normalized", input.phone)');
    expect(source).toContain('.select("id")');
    expect(source).toContain(
      "phone: resolution.normalizedPhone ?? input.message.from",
    );
  });

  it("preserves STOP suppression while verifying the inbound number", () => {
    const verifiedAt = "2026-08-23T02:01:00.000Z";

    expect(
      existingContactPointUpdateForInboundSms("stop", verifiedAt),
    ).toEqual({
      verification_status: "verified",
      verified_at: verifiedAt,
      consent_status: "opted_out",
      consent_source: "twilio_keyword",
      consent_recorded_at: verifiedAt,
      opt_out_reason: "customer_keyword",
    });
  });
});
