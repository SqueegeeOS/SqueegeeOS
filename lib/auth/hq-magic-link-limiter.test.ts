import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyHqMagicLinkDeliveryError,
  fingerprintHqAuthValue,
  isActiveHqMagicLinkRecipient,
  isHqEdgeAbuseControlVerified,
  normalizeHqLoginEmail,
  readHqRequestNetwork,
  reserveHqMagicLinkRequest,
} from "./hq-magic-link-limiter";
import { resolveSafeHqNextPath } from "./hq-navigation";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Headquarters magic-link input", () => {
  it("normalizes email without approving or looking it up", () => {
    expect(normalizeHqLoginEmail("  Person@Example.COM ")).toBe(
      "person@example.com",
    );
    expect(normalizeHqLoginEmail("not-an-email")).toBeNull();
  });

  it("accepts only local Headquarters next paths", () => {
    expect(resolveSafeHqNextPath("/hq/production-health?tab=jobber")).toBe(
      "/hq/production-health?tab=jobber",
    );
    expect(resolveSafeHqNextPath("https://evil.example/hq")).toBe("/hq");
    expect(resolveSafeHqNextPath("//evil.example/hq")).toBe("/hq");
    expect(resolveSafeHqNextPath("/portal/token")).toBe("/hq");
  });

  it("stores stable HMAC fingerprints rather than raw identifiers", () => {
    const secret = "a".repeat(32);
    const fingerprint = fingerprintHqAuthValue(
      "email:person@example.com",
      secret,
    );
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain("person@example.com");
    expect(fingerprint).toBe(
      fingerprintHqAuthValue("email:person@example.com", secret),
    );
  });

  it("accepts only Vercel's singular validated client-IP header", () => {
    expect(
      readHqRequestNetwork(
        new Request("https://homeatlas.example/auth/hq/request", {
          headers: { "x-vercel-forwarded-for": "203.0.113.7" },
        }),
        true,
      ),
    ).toBe("203.0.113.7");
    expect(
      readHqRequestNetwork(
        new Request("https://homeatlas.example/auth/hq/request", {
          headers: { "x-vercel-forwarded-for": "2001:db8::7" },
        }),
        true,
      ),
    ).toBe("2001:db8::7");
    for (const headers of [
      { "x-forwarded-for": "203.0.113.7" },
      { "x-real-ip": "203.0.113.7" },
      { "x-vercel-forwarded-for": "203.0.113.7, 198.51.100.4" },
      { "x-vercel-forwarded-for": "not-an-ip" },
    ] as Array<Record<string, string>>) {
      expect(
        readHqRequestNetwork(
          new Request("https://homeatlas.example/auth/hq/request", {
            headers,
          }),
          true,
        ),
      ).toBeNull();
    }
    expect(
      readHqRequestNetwork(
        new Request("https://homeatlas.example/auth/hq/request", {
          headers: { "x-vercel-forwarded-for": "203.0.113.7" },
        }),
        false,
      ),
    ).toBeNull();
  });

  it("requires an explicit edge abuse-control release attestation", () => {
    expect(isHqEdgeAbuseControlVerified("1")).toBe(true);
    expect(isHqEdgeAbuseControlVerified("true")).toBe(false);
    expect(isHqEdgeAbuseControlVerified(undefined)).toBe(false);
  });

  it.each([
    [null, "provider_accepted"],
    [{ name: "AuthApiError", status: 400 }, "provider_rejected"],
    [{ name: "AuthRetryableFetchError", status: 400 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 408 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 429 }, "provider_unknown"],
    [{ name: "AuthApiError", status: 503 }, "provider_unknown"],
    [new Error("transport"), "provider_unknown"],
  ])("classifies provider delivery evidence truthfully", (error, outcome) => {
    expect(classifyHqMagicLinkDeliveryError(error)).toBe(outcome);
  });
});

describe("Headquarters magic-link recipient authorization", () => {
  function lookupClient(data: {
    user_id: string;
    email: string;
    role: string;
    active: boolean;
  } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    return { client: { from: vi.fn(() => ({ select })) }, select, eq };
  }

  it("requires the exact normalized active owner/operator allowlist row", async () => {
    const lookup = lookupClient({
      user_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
      email: "operator@example.com",
      role: "operator",
      active: true,
    });
    await expect(
      isActiveHqMagicLinkRecipient(
        "operator@example.com",
        lookup.client as never,
      ),
    ).resolves.toBe(true);
    expect(lookup.select).toHaveBeenCalledWith("user_id, email, role, active");
    expect(lookup.eq).toHaveBeenCalledWith("email", "operator@example.com");
  });

  it.each([
    [null, "missing"],
    [
      {
        user_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
        email: "operator@example.com",
        role: "operator",
        active: false,
      },
      "inactive",
    ],
    [
      {
        user_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
        email: "operator@example.com",
        role: "admin",
        active: true,
      },
      "invalid role",
    ],
    [
      {
        user_id: "2d9bfd32-1262-40af-9ce2-33f5710ed85b",
        email: "other@example.com",
        role: "owner",
        active: true,
      },
      "email mismatch",
    ],
  ])("rejects a %s allowlist result", async (data, description) => {
    void description;
    const lookup = lookupClient(data);
    await expect(
      isActiveHqMagicLinkRecipient(
        "operator@example.com",
        lookup.client as never,
      ),
    ).resolves.toBe(false);
  });
});

describe("database-backed magic-link limiter", () => {
  it("uses the atomic database reservation and honors a denial", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          request_id: "38ded46f-70f6-4e8c-9a30-e388ae70c19e",
          is_allowed: false,
        },
      ],
      error: null,
    });
    const client = { rpc };
    await expect(
      reserveHqMagicLinkRequest("person@example.com", "203.0.113.4", {
        client: client as never,
        secret: "b".repeat(32),
      }),
    ).resolves.toEqual({
      requestId: "38ded46f-70f6-4e8c-9a30-e388ae70c19e",
      allowed: false,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[0]).toBe("reserve_hq_magic_link_request");
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      requested_window_seconds: 900,
      requested_email_limit: 3,
      requested_network_limit: 10,
    });
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).not.toContain(
      "person@example.com",
    );
  });

  it("fails before contacting Supabase when the HMAC secret is missing", async () => {
    vi.stubEnv("HQ_AUTH_LIMITER_SECRET", "");
    await expect(
      reserveHqMagicLinkRequest("person@example.com", null),
    ).rejects.toThrow("HQ_AUTH_LIMITER_SECRET");
  });
});
