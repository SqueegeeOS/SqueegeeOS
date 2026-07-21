import { describe, expect, it } from "vitest";
import { isPortalRoute } from "./pricing-settings-path";

describe("pricing settings path", () => {
  it.each([
    "/portal",
    "/portal/opaque-token",
    "/portal/opaque-token/home-health",
    "/homecare/member/property/portal",
    "/homecare/member/property/portal/home-health",
  ])("identifies portal route %s", (pathname) => {
    expect(isPortalRoute(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/portal-preview",
    "/homecare/member/property/plan",
    "/homecare/member/portal",
    "/homecare/member/property/portal-preview",
    "/hq/settings/pricing",
  ])("does not classify non-portal route %s", (pathname) => {
    expect(isPortalRoute(pathname)).toBe(false);
  });
});
