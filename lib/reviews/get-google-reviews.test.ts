import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewsData } from "./types";

const mocks = vi.hoisted(() => ({
  configured: true,
  publicFull: true,
  revision: vi.fn(),
  status: vi.fn(),
  connection: vi.fn(),
  record: vi.fn(),
  full: vi.fn(),
  places: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("./config", () => ({
  GOOGLE_REVIEWS_CACHE_SECONDS: 28_800,
  getGoogleMapsApiKey: () => (mocks.configured ? "maps-key" : null),
  getGooglePlaceId: () => (mocks.configured ? "place-id" : null),
  isPublicFullGoogleReviewDisplayEnabled: () => mocks.publicFull,
}));

vi.mock("./google-business-connection-store", () => ({
  getFreshGoogleBusinessConnection: mocks.connection,
  readGoogleBusinessConnectionStatus: mocks.status,
  readGoogleBusinessConnectionRevision: mocks.revision,
  recordGoogleBusinessSyncResult: mocks.record,
}));

vi.mock("./google-business-reviews", () => ({
  fetchAllGoogleBusinessReviews: mocks.full,
}));

vi.mock("./google-places", () => ({
  fetchGooglePlaceReviewsWithCredentials: mocks.places,
}));

import { getGoogleReviewsResponse } from "./get-google-reviews";

function data(overrides: Partial<ReviewsData> = {}): ReviewsData {
  return {
    totalCount: 1,
    averageRating: 5,
    source: "Google",
    reviews: [],
    fetchedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.publicFull = true;
  mocks.revision.mockResolvedValue("connection-revision-7");
  mocks.status.mockResolvedValue(null);
  mocks.connection.mockResolvedValue({
    identity: {
      accountName: "accounts/1",
      locationName: "locations/2",
      locationTitle: "SqueegeeKing",
      placeId: "place-id",
      oauthEmail: "owner@example.com",
    },
    accessToken: "access-token",
    tokenGeneration: 7,
    connectionRevision: "connection-revision-7",
  });
  mocks.full.mockRejectedValue(new Error("not connected"));
  mocks.places.mockResolvedValue(
    { data: data({ coverage: "preview", provider: "google_places" }) },
  );
  mocks.record.mockResolvedValue(true);
});

describe("Google reviews source selection", () => {
  it("prefers the complete owned-profile review corpus", async () => {
    mocks.full.mockResolvedValue(
      data({
        totalCount: 128,
        coverage: "complete",
        provider: "google_business_profile",
        fetchedAt: new Date().toISOString(),
      }),
    );

    const response = await getGoogleReviewsResponse();

    expect(response.status).toBe("cached");
    expect(response.data?.coverage).toBe("complete");
    expect(response.data?.totalCount).toBe(128);
    expect(mocks.places).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith({
      reviewCount: 0,
      errorCode: undefined,
      tokenGeneration: 7,
      connectionRevision: "connection-revision-7",
    });
  });

  it("falls back to the supported Places preview when full access is unavailable", async () => {
    const response = await getGoogleReviewsResponse();

    expect(response.status).toBe("live");
    expect(response.data?.coverage).toBe("preview");
    expect(response.message).toContain("Places review preview");
  });

  it("keeps owner-only full reviews gated until public use is approved", async () => {
    mocks.publicFull = false;

    const response = await getGoogleReviewsResponse();

    expect(response.data?.provider).toBe("google_places");
    expect(mocks.revision).not.toHaveBeenCalled();
    expect(mocks.full).not.toHaveBeenCalled();
  });

  it("binds the Places fallback to the durable selected location", async () => {
    mocks.publicFull = false;
    mocks.status.mockResolvedValue({
      connected: true,
      status: "connected",
      placeId: "selected-place",
    });

    await getGoogleReviewsResponse();

    expect(mocks.places).toHaveBeenCalledWith("maps-key", "selected-place");
  });

  it("fails closed when a connected service-area profile has no Place ID", async () => {
    mocks.publicFull = false;
    mocks.status.mockResolvedValue({
      connected: true,
      status: "connected",
      placeId: null,
    });

    const response = await getGoogleReviewsResponse();

    expect(response.status).toBe("unavailable");
    expect(mocks.places).not.toHaveBeenCalled();
  });

  it("keeps an errored durable selection authoritative over the environment", async () => {
    mocks.publicFull = false;
    mocks.status.mockResolvedValue({
      connected: false,
      status: "refresh_required",
      placeId: "selected-place-needs-auth",
    });

    await getGoogleReviewsResponse();

    expect(mocks.places).toHaveBeenCalledWith(
      "maps-key",
      "selected-place-needs-auth",
    );
  });

  it("fails safely when neither review source is configured", async () => {
    mocks.configured = false;

    const response = await getGoogleReviewsResponse();

    expect(response.status).toBe("unavailable");
    expect(response.data?.reviews).toEqual([]);
    expect(mocks.places).not.toHaveBeenCalled();
  });
});
