import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWelcomeEmail } from "./send-welcome-email";

describe("sendWelcomeEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a safe portal link with a Resend idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv(
      "RESEND_AGREEMENT_FROM",
      "HomeAtlas <care@squeegeeking.net>",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWelcomeEmail({
      to: "member@example.com",
      name: "<Noah>",
      portalUrl: "https://www.squeegeeking.net/portal/private-token",
      idempotencyKey: "membership-welcome-123",
    });

    expect(result).toMatchObject({
      status: "sent",
      recipient: "member@example.com",
      resendId: "email_123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "membership-welcome-123",
    });
    const payload = JSON.parse(String(request.body)) as { html: string };
    expect(payload.html).toContain(
      "https://www.squeegeeking.net/portal/private-token",
    );
    expect(payload.html).toContain("&lt;Noah&gt;");
    expect(payload.html).not.toContain("<Noah>");
  });

  it("returns a failed result when Resend cannot be reached", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await sendWelcomeEmail({
      to: "member@example.com",
      name: "Member",
      portalUrl: "https://www.squeegeeking.net/portal/private-token",
    });

    expect(result).toMatchObject({
      status: "failed",
      reason: "resend_request_failed",
    });
  });

  it("rejects non-http portal URLs before sending", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWelcomeEmail({
      to: "member@example.com",
      name: "Member",
      portalUrl: "javascript:alert(1)",
    });

    expect(result).toMatchObject({
      status: "failed",
      reason: "invalid_portal_url",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
