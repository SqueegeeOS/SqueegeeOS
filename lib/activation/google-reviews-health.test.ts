import { describe, expect, it } from "vitest";
import {
  buildGoogleReviewsHealth,
  type GoogleReviewsHealthInput,
} from "./google-reviews-health";

const NOW = Date.parse("2026-08-02T12:00:00.000Z");

function healthyInput(
  overrides: Partial<GoogleReviewsHealthInput> = {},
): GoogleReviewsHealthInput {
  return {
    oauthConfigured: true,
    tokenEncryptionReady: true,
    ownerConnectionState: "connected",
    durablePlaceId: "selected-place",
    envPlaceId: "selected-place",
    mapsApiKeyConfigured: true,
    lastFullSyncAt: "2026-08-02T11:00:00.000Z",
    lastFullReviewCount: 128,
    lastErrorCode: null,
    publicFullReviewsEnabled: false,
    now: NOW,
    ...overrides,
  };
}

describe("buildGoogleReviewsHealth", () => {
  it("is healthy only when owner sync and a public source are ready", () => {
    const result = buildGoogleReviewsHealth(healthyInput());

    expect(result.status).toBe("healthy");
    expect(result.message).toContain("Owner connected");
    expect(result.message).toContain("sync current");
    expect(result.message).toContain("Google Maps preview");
  });

  it("does not report healthy from OAuth and Places environment alone", () => {
    const result = buildGoogleReviewsHealth(
      healthyInput({
        ownerConnectionState: "not_connected",
        durablePlaceId: null,
        lastFullSyncAt: null,
        lastFullReviewCount: null,
      }),
    );

    expect(result.status).toBe("attention");
    expect(result.message).toContain("not connected");
    expect(result.message).toContain("Google Maps preview");
  });

  it("reports a stale or failed owner sync as attention", () => {
    const stale = buildGoogleReviewsHealth(
      healthyInput({ lastFullSyncAt: "2026-07-31T10:00:00.000Z" }),
    );
    const failed = buildGoogleReviewsHealth(
      healthyInput({ lastErrorCode: "google_business_reviews_partial" }),
    );

    expect(stale.status).toBe("attention");
    expect(stale.message).toContain("sync stale");
    expect(failed.status).toBe("attention");
    expect(failed.detail).toContain("google_business_reviews_partial");
  });

  it("blocks healthy status when the selected and JSON-LD Place IDs differ", () => {
    const result = buildGoogleReviewsHealth(
      healthyInput({ envPlaceId: "old-env-place" }),
    );

    expect(result.status).toBe("attention");
    expect(result.message).toContain("Place ID mismatch");
    expect(result.detail).toContain("selected-place");
    expect(result.detail).toContain("old-env-place");
    expect(result.detail).toContain("JSON-LD");
  });

  it("also flags a missing GOOGLE_PLACE_ID for a selected durable Place ID", () => {
    const result = buildGoogleReviewsHealth(healthyInput({ envPlaceId: null }));

    expect(result.status).toBe("attention");
    expect(result.detail).toContain("GOOGLE_PLACE_ID missing");
  });

  it("distinguishes an approved full archive from an unavailable public source", () => {
    const fullArchive = buildGoogleReviewsHealth(
      healthyInput({
        durablePlaceId: null,
        envPlaceId: null,
        mapsApiKeyConfigured: false,
        publicFullReviewsEnabled: true,
      }),
    );
    const unavailable = buildGoogleReviewsHealth(
      healthyInput({ mapsApiKeyConfigured: false }),
    );

    expect(fullArchive.status).toBe("healthy");
    expect(fullArchive.message).toContain("full owner review archive");
    expect(unavailable.status).toBe("offline");
    expect(unavailable.message).toContain("public Google reviews are unavailable");
  });
});
