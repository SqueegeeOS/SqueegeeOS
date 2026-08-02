import { describe, expect, it, vi } from "vitest";
import {
  sendTwilioSms,
  type TwilioSmsConfig,
} from "./twilio-sms";

const accountSid = `AC${"1".repeat(32)}`;
const config: TwilioSmsConfig = {
  accountSid,
  authToken: "twilio-auth-secret",
  fromNumber: "+15305550100",
  statusCallbackUrl:
    "https://www.squeegeeking.net/api/integrations/twilio/status",
};

describe("Twilio SMS provider", () => {
  it("sends an E.164 message with a status callback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ sid: `SM${"2".repeat(32)}`, status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await sendTwilioSms(
      { to: "+15305550101", body: "Your SqueegeeKing quote is ready." },
      { config, fetch: fetchMock },
    );

    expect(result).toEqual({
      ok: true,
      provider: "twilio",
      channel: "sms",
      providerMessageId: `SM${"2".repeat(32)}`,
      status: "queued",
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    );
    expect(request.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    });
    const form = new URLSearchParams(String(request.body));
    expect(Object.fromEntries(form)).toEqual({
      To: "+15305550101",
      Body: "Your SqueegeeKing quote is ready.",
      StatusCallback:
        "https://www.squeegeeking.net/api/integrations/twilio/status",
      From: "+15305550100",
    });
  });

  it("rejects invalid destinations and oversized bodies before sending", async () => {
    const fetchMock = vi.fn();

    await expect(
      sendTwilioSms(
        { to: "5305550101", body: "Hello" },
        { config, fetch: fetchMock },
      ),
    ).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_destination",
    });

    await expect(
      sendTwilioSms(
        { to: "+15305550101", body: "x".repeat(1_601) },
        { config, fetch: fetchMock },
      ),
    ).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_body",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a Messaging Service sender when configured", async () => {
    const messagingServiceSid = `MG${"3".repeat(32)}`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ sid: `SM${"4".repeat(32)}`, status: "accepted" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await sendTwilioSms(
      { to: "+15305550101", body: "Hello" },
      {
        config: { ...config, messagingServiceSid, fromNumber: undefined },
        fetch: fetchMock,
      },
    );

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = new URLSearchParams(String(request.body));
    expect(form.get("MessagingServiceSid")).toBe(messagingServiceSid);
    expect(form.has("From")).toBe(false);
  });
});
