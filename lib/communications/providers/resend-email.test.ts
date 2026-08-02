import { describe, expect, it, vi } from "vitest";
import { sendResendEmail, type ResendEmailConfig } from "./resend-email";

const config: ResendEmailConfig = {
  apiKey: "re_secret_test",
  from: "SqueegeeKing <care@squeegeeking.net>",
};

describe("Resend email provider", () => {
  it("sends with idempotency and a reply-to mailbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendResendEmail(
      {
        to: " MEMBER@EXAMPLE.COM ",
        subject: "Your quote is ready",
        replyTo: "hello@squeegeeking.net",
        idempotencyKey: "lead-123-quote-ready",
        html: "<p>Your quote is ready.</p>",
        text: "Your quote is ready.",
      },
      { config, fetch: fetchMock },
    );

    expect(result).toEqual({
      ok: true,
      provider: "resend",
      channel: "email",
      providerMessageId: "email_123",
      status: "accepted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer re_secret_test",
      "Idempotency-Key": "lead-123-quote-ready",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      from: "SqueegeeKing <care@squeegeeking.net>",
      to: ["member@example.com"],
      reply_to: "hello@squeegeeking.net",
      subject: "Your quote is ready",
      html: "<p>Your quote is ready.</p>",
      text: "Your quote is ready.",
    });
  });

  it("rejects unsafe fields before contacting Resend", async () => {
    const fetchMock = vi.fn();

    await expect(
      sendResendEmail(
        {
          to: "member@example.com",
          subject: "Hello",
          replyTo: "hello@squeegeeking.net",
          idempotencyKey: "bad\r\nheader",
          text: "Hello",
        },
        { config, fetch: fetchMock },
      ),
    ).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_idempotency_key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe error code without copying provider response content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"message":"secret provider detail"}', { status: 401 }),
    );

    const result = await sendResendEmail(
      {
        to: "member@example.com",
        subject: "Hello",
        replyTo: "hello@squeegeeking.net",
        idempotencyKey: "message-123",
        text: "Hello",
      },
      { config, fetch: fetchMock },
    );

    expect(result).toMatchObject({
      ok: false,
      errorCode: "authentication_failed",
      httpStatus: 401,
    });
    expect(JSON.stringify(result)).not.toContain("secret provider detail");
  });
});
