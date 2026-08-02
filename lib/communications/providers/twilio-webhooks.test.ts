import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifySmsConsentKeyword,
  parseTwilioInboundForm,
  twilioFormToParams,
  verifyTwilioWebhookSignature,
} from "./twilio-webhooks";

function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

describe("Twilio webhook helpers", () => {
  it("validates the exact URL and every form parameter with the Twilio SDK", () => {
    const authToken = "twilio-auth-secret";
    const url = "https://www.squeegeeking.net/api/integrations/twilio/inbound";
    const params = {
      MessageSid: `SM${"a".repeat(32)}`,
      From: "+15305550101",
      To: "+15305550100",
      Body: "Can I get a quote?",
      FutureTwilioField: "must-be-signed-too",
    };
    const signature = twilioSignature(authToken, url, params);

    expect(
      verifyTwilioWebhookSignature({ authToken, signature, url, params }),
    ).toBe(true);
    expect(
      verifyTwilioWebhookSignature({
        authToken,
        signature,
        url,
        params: { ...params, Body: "changed" },
      }),
    ).toBe(false);
  });

  it("parses inbound form fields and classifies STOP/START variants", () => {
    const form = new URLSearchParams({
      MessageSid: `SM${"b".repeat(32)}`,
      From: "+15305550101",
      To: "+15305550100",
      Body: " unsubscribe ",
    });

    expect(parseTwilioInboundForm(form)).toEqual({
      messageSid: `SM${"b".repeat(32)}`,
      from: "+15305550101",
      to: "+15305550100",
      body: "unsubscribe",
      consentKeyword: "stop",
    });
    expect(classifySmsConsentKeyword("Unstop")).toBe("start");
    expect(classifySmsConsentKeyword("STOP!")).toBe("stop");
    expect(classifySmsConsentKeyword("please stop texting me")).toBe("stop");
    expect(classifySmsConsentKeyword("do not message this number")).toBe("stop");
    expect(classifySmsConsentKeyword("take me off your text list")).toBe("stop");
    expect(classifySmsConsentKeyword("no more texts please")).toBe("stop");
    expect(classifySmsConsentKeyword("please don't stop by today")).toBe("none");
    expect(classifySmsConsentKeyword("do not send it until Tuesday")).toBe("none");
  });

  it("honors Twilio Advanced Opt-Out classification and keeps all form params", () => {
    const form = new URLSearchParams({
      MessageSid: `SM${"c".repeat(32)}`,
      From: "+15305550101",
      To: "+15305550100",
      Body: "custom localized opt-out",
      OptOutType: "STOP",
      NumMedia: "0",
    });

    expect(parseTwilioInboundForm(form)?.consentKeyword).toBe("stop");
    expect(twilioFormToParams(form)).toEqual({
      MessageSid: `SM${"c".repeat(32)}`,
      From: "+15305550101",
      To: "+15305550100",
      Body: "custom localized opt-out",
      OptOutType: "STOP",
      NumMedia: "0",
    });
  });

  it("rejects malformed inbound identifiers and phone numbers", () => {
    expect(
      parseTwilioInboundForm({
        MessageSid: "SM-short",
        From: "5305550101",
        To: "+15305550100",
        Body: "Hello",
      }),
    ).toBeNull();
  });
});
