import { describe, expect, it, vi } from "vitest";
import { handleHqMagicLinkRequest } from "../../app/auth/hq/request/route";

const URL = "https://homeatlas.example/auth/hq/request";
const TRUSTED_IP = "203.0.113.8";
const EXPECTED_MESSAGE =
  "If access is available for that address, a secure sign-in link will arrive shortly.";

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": TRUSTED_IP,
      ...headers,
    },
    body,
  });
}

async function expectNeutral(response: Response) {
  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    message: EXPECTED_MESSAGE,
  });
  expect(response.headers.get("Cache-Control")).toBe(
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  expect(response.headers.get("Expires")).toBe("0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
}

describe("public HQ magic-link route", () => {
  it("enforces the actual streamed byte limit without Content-Length", async () => {
    const reserve = vi.fn();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"email":"'));
        controller.enqueue(encoder.encode("a".repeat(5000)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });
    const request = new Request(URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-forwarded-for": TRUSTED_IP,
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expectNeutral(
      await handleHqMagicLinkRequest(request, {
        reserve,
        edgeControlVerified: true,
        vercelDeployment: true,
      }),
    );
    expect(reserve).not.toHaveBeenCalled();
  });

  it.each(["invalid", "-1", "4097", "1,2"])(
    "rejects malformed or oversized Content-Length %s before reservation",
    async (contentLength) => {
      const reserve = vi.fn();
      await expectNeutral(
        await handleHqMagicLinkRequest(
          jsonRequest('{"email":"operator@example.com"}', {
            "content-length": contentLength,
          }),
          {
            reserve,
            edgeControlVerified: true,
            vercelDeployment: true,
          },
        ),
      );
      expect(reserve).not.toHaveBeenCalled();
    },
  );

  it("fails neutral before Supabase when trusted network or edge proof is absent", async () => {
    const reserve = vi.fn();
    await expectNeutral(
      await handleHqMagicLinkRequest(
        jsonRequest('{"email":"operator@example.com"}'),
        {
          reserve,
          edgeControlVerified: false,
          vercelDeployment: true,
        },
      ),
    );
    await expectNeutral(
      await handleHqMagicLinkRequest(
        new Request(URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": TRUSTED_IP,
          },
          body: '{"email":"operator@example.com"}',
        }),
        {
          reserve,
          edgeControlVerified: true,
          vercelDeployment: true,
        },
      ),
    );
    expect(reserve).not.toHaveBeenCalled();
  });

  it("requests no user creation, preserves a safe next path, and audits delivery", async () => {
    const reserve = vi.fn().mockResolvedValue({
      requestId: "ae55cb84-607a-453c-a3eb-461e5978395d",
      allowed: true,
    });
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const recordDelivery = vi.fn().mockResolvedValue(undefined);

    await expectNeutral(
      await handleHqMagicLinkRequest(
        jsonRequest(
          JSON.stringify({
            email: " Operator@Example.com ",
            next: "/hq/production-health?tab=jobber",
          }),
        ),
        {
          reserve,
          isRecipientApproved: vi.fn().mockResolvedValue(true),
          recordDelivery,
          createClient: (async () => ({
            auth: { signInWithOtp },
          })) as never,
          edgeControlVerified: true,
          vercelDeployment: true,
        },
      ),
    );

    expect(reserve).toHaveBeenCalledWith("operator@example.com", TRUSTED_IP);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "operator@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "https://homeatlas.example/auth/hq/callback?next=%2Fhq%2Fproduction-health%3Ftab%3Djobber",
      },
    });
    expect(recordDelivery).toHaveBeenCalledWith(
      "ae55cb84-607a-453c-a3eb-461e5978395d",
      "provider_accepted",
    );
  });

  it.each([
    ["missing", false],
    ["inactive", false],
    ["invalid role", false],
    ["email mismatch", false],
  ])(
    "returns the neutral response and never requests OTP for a %s recipient",
    async (_condition, approved) => {
      const reserve = vi.fn().mockResolvedValue({
        requestId: "ae55cb84-607a-453c-a3eb-461e5978395d",
        allowed: true,
      });
      const signInWithOtp = vi.fn();
      const recordDelivery = vi.fn();

      await expectNeutral(
        await handleHqMagicLinkRequest(
          jsonRequest('{"email":"operator@example.com"}'),
          {
            reserve,
            isRecipientApproved: vi.fn().mockResolvedValue(approved),
            recordDelivery,
            createClient: (async () => ({
              auth: { signInWithOtp },
            })) as never,
            edgeControlVerified: true,
            vercelDeployment: true,
          },
        ),
      );

      expect(signInWithOtp).not.toHaveBeenCalled();
      expect(recordDelivery).not.toHaveBeenCalled();
    },
  );

  it("fails neutral without OTP when the recipient lookup is unavailable", async () => {
    const signInWithOtp = vi.fn();
    await expectNeutral(
      await handleHqMagicLinkRequest(
        jsonRequest('{"email":"operator@example.com"}'),
        {
          reserve: vi.fn().mockResolvedValue({
            requestId: "ae55cb84-607a-453c-a3eb-461e5978395d",
            allowed: true,
          }),
          isRecipientApproved: vi.fn().mockRejectedValue(new Error("offline")),
          createClient: (async () => ({
            auth: { signInWithOtp },
          })) as never,
          edgeControlVerified: true,
          vercelDeployment: true,
        },
      ),
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "AuthRetryableFetchError", status: 503 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 500 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 429 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 400 }, "provider_rejected"],
  ])("records returned provider errors as %s", async (error, expected) => {
    const recordDelivery = vi.fn().mockResolvedValue(undefined);
    await expectNeutral(
      await handleHqMagicLinkRequest(
        jsonRequest('{"email":"operator@example.com"}'),
        {
          reserve: vi.fn().mockResolvedValue({
            requestId: "ae55cb84-607a-453c-a3eb-461e5978395d",
            allowed: true,
          }),
          isRecipientApproved: vi.fn().mockResolvedValue(true),
          recordDelivery,
          createClient: (async () => ({
            auth: { signInWithOtp: vi.fn().mockResolvedValue({ error }) },
          })) as never,
          edgeControlVerified: true,
          vercelDeployment: true,
        },
      ),
    );
    expect(recordDelivery).toHaveBeenCalledWith(
      "ae55cb84-607a-453c-a3eb-461e5978395d",
      expected,
    );
  });

  it("records a thrown transport outcome as unknown, never rejected", async () => {
    const recordDelivery = vi.fn().mockResolvedValue(undefined);
    await expectNeutral(
      await handleHqMagicLinkRequest(
        jsonRequest('{"email":"operator@example.com"}'),
        {
          reserve: vi.fn().mockResolvedValue({
            requestId: "ae55cb84-607a-453c-a3eb-461e5978395d",
            allowed: true,
          }),
          isRecipientApproved: vi.fn().mockResolvedValue(true),
          recordDelivery,
          createClient: (async () => ({
            auth: {
              signInWithOtp: vi
                .fn()
                .mockRejectedValue(new Error("connection reset")),
            },
          })) as never,
          edgeControlVerified: true,
          vercelDeployment: true,
        },
      ),
    );
    expect(recordDelivery).toHaveBeenCalledWith(
      "ae55cb84-607a-453c-a3eb-461e5978395d",
      "provider_unknown",
    );
  });
});
