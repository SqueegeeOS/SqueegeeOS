import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildJobberAuthorizationUrl,
  getExpectedJobberAccountId,
  getJobberConfigStatus,
  resolveJobberOAuthRedirectUri,
  suggestJobberOAuthRedirectUri,
} from "./jobber-oauth-config";
import {
  decryptJobberToken,
  encryptJobberToken,
} from "./jobber-token-crypto";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Jobber OAuth configuration", () => {
  it("builds the exact authorization-code URL without adding write scopes", () => {
    const authorization = new URL(
      buildJobberAuthorizationUrl({
        clientId: "client-123",
        redirectUri: "https://app.example.com/jobber/callback",
        state: "state-123",
      }),
    );

    expect(authorization.origin + authorization.pathname).toBe(
      "https://api.getjobber.com/api/oauth/authorize",
    );
    expect(Object.fromEntries(authorization.searchParams)).toEqual({
      response_type: "code",
      client_id: "client-123",
      redirect_uri: "https://app.example.com/jobber/callback",
      state: "state-123",
    });
    expect(authorization.searchParams.has("scope")).toBe(false);
  });

  it("requires an explicit production callback and expected account authority", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOBBER_CLIENT_ID", "client");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "secret");
    vi.stubEnv("JOBBER_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("JOBBER_EXPECTED_ACCOUNT_ID", "jobber-account");
    vi.stubEnv("JOBBER_OAUTH_REDIRECT_URI", "");

    expect(getJobberConfigStatus().configured).toBe(false);
    expect(() =>
      resolveJobberOAuthRedirectUri(
        new Request("https://app.example.com/api/jobber/start"),
      ),
    ).toThrow("required in production");
  });

  it("does not accept a merely present but invalid encryption key", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JOBBER_CLIENT_ID", "client");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "secret");
    vi.stubEnv("JOBBER_EXPECTED_ACCOUNT_ID", "jobber-account");
    vi.stubEnv("JOBBER_TOKEN_ENCRYPTION_KEY", "too-short");
    expect(getJobberConfigStatus().encryptionKeyConfigured).toBe(false);
    expect(getJobberConfigStatus().configured).toBe(false);
  });

  it("fails readiness and direct lookup closed without expected account authority", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JOBBER_CLIENT_ID", "client");
    vi.stubEnv("JOBBER_CLIENT_SECRET", "secret");
    vi.stubEnv(
      "JOBBER_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 9).toString("base64"),
    );
    vi.stubEnv("JOBBER_EXPECTED_ACCOUNT_ID", "   ");

    expect(getJobberConfigStatus().expectedAccountIdConfigured).toBe(false);
    expect(getJobberConfigStatus().configured).toBe(false);
    expect(() => getExpectedJobberAccountId()).toThrow("not configured");
  });

  it("derives a callback from the request only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      resolveJobberOAuthRedirectUri(
        new Request("http://localhost:3456/api/jobber/start"),
      ),
    ).toBe(
      "http://localhost:3456/api/admin/care-operations/jobber/oauth/callback",
    );
  });

  it("shows a stable app-origin callback suggestion without weakening production checks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("JOBBER_OAUTH_REDIRECT_URI", "");
    expect(
      suggestJobberOAuthRedirectUri(
        new Request("https://deployment-preview.vercel.app/api/status"),
      ),
    ).toBe(
      "https://app.example.com/api/admin/care-operations/jobber/oauth/callback",
    );
  });
});

describe("Jobber token encryption", () => {
  it("round-trips tokens through authenticated AES-256-GCM encryption", () => {
    vi.stubEnv(
      "JOBBER_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 11).toString("base64"),
    );
    const encrypted = encryptJobberToken("refresh-token-value");

    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptJobberToken(encrypted)).toBe("refresh-token-value");
  });

  it("rejects ciphertext that has been modified", () => {
    vi.stubEnv(
      "JOBBER_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 13).toString("base64"),
    );
    const encrypted = encryptJobberToken("access-token-value");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptJobberToken(tampered)).toThrow();
  });

  it("rejects a key that is not exactly 32 bytes", () => {
    vi.stubEnv(
      "JOBBER_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(16, 1).toString("base64"),
    );
    expect(() => encryptJobberToken("token")).toThrow("exactly 32 bytes");
  });
});
