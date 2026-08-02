import { unstable_cache } from "next/cache";
import {
  GOOGLE_REVIEWS_CACHE_SECONDS,
  getGoogleMapsApiKey,
  getGooglePlaceId,
  isPublicFullGoogleReviewDisplayEnabled,
} from "./config";
import {
  getFreshGoogleBusinessConnection,
  readGoogleBusinessConnectionStatus,
  readGoogleBusinessConnectionRevision,
  recordGoogleBusinessSyncResult,
} from "./google-business-connection-store";
import { fetchAllGoogleBusinessReviews } from "./google-business-reviews";
import { fetchGoogleBusinessLocationMapsUrl } from "./google-business-profile";
import { fetchGooglePlaceReviewsWithCredentials } from "./google-places";
import type { GoogleReviewsApiResponse } from "./types";

const getCachedFullGoogleBusinessReviews = unstable_cache(
  async (expectedRevision: string) => {
    const connection = await getFreshGoogleBusinessConnection();
    const {
      identity,
      accessToken,
      tokenGeneration,
      connectionRevision,
    } = connection;
    if (connectionRevision !== expectedRevision) {
      throw new Error("Google Business connection changed during review sync");
    }

    try {
      const [reviewData, refreshedBusinessUrl] = await Promise.all([
        fetchAllGoogleBusinessReviews({
          accessToken,
          accountName: identity.accountName,
          locationName: identity.locationName,
          placeId: identity.placeId,
          businessName: identity.locationTitle,
        }),
        fetchGoogleBusinessLocationMapsUrl({
          accessToken,
          accountName: identity.accountName,
          locationName: identity.locationName,
        }).catch(() => undefined),
      ]);
      const data = refreshedBusinessUrl
        ? { ...reviewData, businessUrl: refreshedBusinessUrl }
        : reviewData;
      const recorded = await recordGoogleBusinessSyncResult({
        reviewCount: data.reviews.length,
        errorCode:
          data.coverage === "complete"
            ? undefined
            : "google_business_reviews_partial",
        tokenGeneration,
        connectionRevision,
      });
      if (!recorded) {
        throw new Error("Google Business connection changed during review sync");
      }
      return data;
    } catch (error) {
      await recordGoogleBusinessSyncResult({
        errorCode: "google_business_reviews_unavailable",
        tokenGeneration,
        connectionRevision,
      });
      throw error;
    }
  },
  ["squeegeeking-google-business-full-reviews"],
  { revalidate: GOOGLE_REVIEWS_CACHE_SECONDS, tags: ["google-reviews"] },
);

export async function getGoogleReviewsResponse(): Promise<GoogleReviewsApiResponse> {
  if (isPublicFullGoogleReviewDisplayEnabled()) {
    try {
      const revision = await readGoogleBusinessConnectionRevision();
      const data = await getCachedFullGoogleBusinessReviews(revision);
      const fetchedAt = data.fetchedAt ? Date.parse(data.fetchedAt) : Number.NaN;
      if (
        !Number.isFinite(fetchedAt) ||
        Date.now() - fetchedAt > 24 * 60 * 60 * 1000
      ) {
        throw new Error("Cached Google Business reviews are too old to display");
      }
      return {
        status: "cached",
        data: {
          ...data,
          isCached: true,
        },
        fetchedAt: data.fetchedAt,
      };
    } catch {
      // Fall through to the supported Places preview or unavailable state.
    }
  }

  const durableConnection = await readGoogleBusinessConnectionStatus().catch(
    () => null,
  );
  const apiKey = getGoogleMapsApiKey();
  const hasDurableSelection = Boolean(
    durableConnection &&
      durableConnection.status !== "not_connected" &&
      durableConnection.status !== "disconnected",
  );
  const placeId = hasDurableSelection
    ? durableConnection?.placeId
    : getGooglePlaceId();

  if (apiKey && placeId) {
    try {
      // Places review content cannot be cached or stored. Fetch the small
      // provider preview directly and mark the public response no-store.
      const { data } = await fetchGooglePlaceReviewsWithCredentials(
        apiKey,
        placeId,
      );
      return {
        status: "live",
        data: {
          ...data,
          isCached: false,
        },
        message:
          "Showing Google's supported Places review preview. Full owner-only review display requires explicit project approval.",
        fetchedAt: data.fetchedAt,
      };
    } catch {
      // Fall through to the safe unavailable response below.
    }
  }

  return {
    status: "unavailable",
    data: {
      totalCount: 0,
      averageRating: 0,
      source: "Google",
      reviews: [],
    },
    message: "Google reviews are not configured yet.",
  };
}
