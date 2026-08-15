import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPortalAccessPath,
  buildPortalAccessUrl,
  generatePortalAccessToken,
  resolvePublicAppOrigin,
} from "./portal-access";

describe("portal access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates URL-safe tokens with high entropy", () => {
    const a = generatePortalAccessToken();
    const b = generatePortalAccessToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(buildPortalAccessPath(a)).toBe(`/portal/${encodeURIComponent(a)}`);
  });

  it("builds absolute portal URLs from origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const token = "abc123";
    expect(buildPortalAccessUrl(token, "https://care.example.com")).toBe(
      "https://care.example.com/portal/abc123",
    );
  });

  it("prefers the configured public site over a request host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.squeegeeking.net/");

    expect(
      buildPortalAccessUrl(
        "abc123",
        "https://squeegee-os-git-main-squeegee-os.vercel.app",
      ),
    ).toBe("https://www.squeegeeking.net/portal/abc123");
  });

  it("never generates customer links on a Vercel deployment host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "squeegee-os-abc123.vercel.app");

    expect(
      buildPortalAccessUrl(
        "abc123",
        "https://squeegee-os-abc123.vercel.app",
      ),
    ).toBe("https://www.squeegeeking.net/portal/abc123");
    expect(
      resolvePublicAppOrigin(
        "https://squeegee-os-abc123.vercel.app",
      ),
    ).toBe("https://www.squeegeeking.net");
  });

  it("falls back to the canonical customer domain", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(buildPortalAccessUrl("abc123")).toBe(
      "https://www.squeegeeking.net/portal/abc123",
    );
  });
});
