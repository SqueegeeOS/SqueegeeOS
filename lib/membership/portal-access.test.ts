import { describe, expect, it } from "vitest";
import {
  buildPortalAccessPath,
  buildPortalAccessUrl,
  generatePortalAccessToken,
} from "./portal-access";

describe("portal access", () => {
  it("generates URL-safe tokens with high entropy", () => {
    const a = generatePortalAccessToken();
    const b = generatePortalAccessToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(buildPortalAccessPath(a)).toBe(`/portal/${encodeURIComponent(a)}`);
  });

  it("builds absolute portal URLs from origin", () => {
    const token = "abc123";
    expect(buildPortalAccessUrl(token, "https://care.example.com")).toBe(
      "https://care.example.com/portal/abc123",
    );
  });
});
