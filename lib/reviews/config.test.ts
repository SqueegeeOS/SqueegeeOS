import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLikelyGooglePlaceId,
  isPublicFullGoogleReviewDisplayEnabled,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Google reviews configuration", () => {
  it("accepts a public Google Place ID", () => {
    expect(isLikelyGooglePlaceId("ChIJQX_D76BQNSARonMZfaOHgKg")).toBe(true);
  });

  it("rejects credentials accidentally pasted into GOOGLE_PLACE_ID", () => {
    expect(isLikelyGooglePlaceId("AIza-not-a-place-id")).toBe(false);
    expect(isLikelyGooglePlaceId("ya29-not-a-place-id")).toBe(false);
    expect(isLikelyGooglePlaceId("https://maps.google.com/example")).toBe(false);
  });

  it("prefers the complete owner-authorized review archive by default", () => {
    vi.stubEnv("GOOGLE_BUSINESS_PUBLIC_FULL_REVIEWS_ENABLED", "");

    expect(isPublicFullGoogleReviewDisplayEnabled()).toBe(true);
  });

  it("keeps an explicit operational kill switch for full review display", () => {
    vi.stubEnv("GOOGLE_BUSINESS_PUBLIC_FULL_REVIEWS_ENABLED", " FALSE ");

    expect(isPublicFullGoogleReviewDisplayEnabled()).toBe(false);
  });
});
