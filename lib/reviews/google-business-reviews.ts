import type { Review, ReviewsData } from "./types";

const GOOGLE_BUSINESS_API_BASE_URL =
  "https://mybusiness.googleapis.com/v4";
const GOOGLE_BUSINESS_REVIEWS_PAGE_SIZE = 50;
const GOOGLE_BUSINESS_REVIEWS_MAX_PAGES = 100;
const GOOGLE_BUSINESS_REVIEWS_TIMEOUT_MS = 30_000;

type GoogleBusinessStarRating =
  | "STAR_RATING_UNSPECIFIED"
  | "ONE"
  | "TWO"
  | "THREE"
  | "FOUR"
  | "FIVE";

interface GoogleBusinessReviewer {
  profilePhotoUrl?: string;
  displayName?: string;
  isAnonymous?: boolean;
}

interface GoogleBusinessReview {
  name?: string;
  reviewId?: string;
  reviewer?: GoogleBusinessReviewer;
  starRating?: GoogleBusinessStarRating | number | string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
}

interface GoogleBusinessReviewsPage {
  reviews?: GoogleBusinessReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
  error?: { message?: string };
}

export interface FetchGoogleBusinessReviewsOptions {
  accessToken: string;
  /** Google resource name in the form `accounts/{accountId}`. */
  accountName: string;
  /** `locations/{locationId}` or its fully qualified account/location name. */
  locationName: string;
  /** Optional public Place ID used as fallback context for malformed review IDs. */
  placeId?: string | null;
  /** Public business title used in Google attribution. */
  businessName: string;
  /** Provider-supplied public Google Maps destination. */
  businessUrl?: string | null;
}

const STAR_RATINGS: Readonly<Record<string, number>> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function normalizeReviewsParent(
  accountResourceName: string,
  locationResourceName: string,
): string {
  const accountName = accountResourceName.trim().replace(/^\/+|\/+$/g, "");
  const locationName = locationResourceName
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!/^accounts\/[^/]+$/.test(accountName)) {
    throw new Error(
      "Google Business Profile account name must match accounts/{accountId}.",
    );
  }

  if (/^locations\/[^/]+$/.test(locationName)) {
    return `${accountName}/${locationName}`;
  }

  if (/^accounts\/[^/]+\/locations\/[^/]+$/.test(locationName)) {
    if (!locationName.startsWith(`${accountName}/`)) {
      throw new Error(
        "Google Business Profile location does not belong to the selected account.",
      );
    }
    return locationName;
  }

  throw new Error(
    "Google Business Profile location name must match locations/{locationId}.",
  );
}

function mapStarRating(
  starRating: GoogleBusinessReview["starRating"],
): number | null {
  if (
    typeof starRating === "number" &&
    Number.isInteger(starRating) &&
    starRating >= 1 &&
    starRating <= 5
  ) {
    return starRating;
  }

  if (typeof starRating !== "string") return null;

  const mapped = STAR_RATINGS[starRating];
  if (mapped) return mapped;

  const numeric = Number(starRating);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5
    ? numeric
    : null;
}

function safeGoogleMapsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol === "https:" &&
      (host === "google.com" || host.endsWith(".google.com"))
    ) {
      return url.toString();
    }
  } catch {
    // Ignore malformed provider metadata.
  }
  return undefined;
}

function reviewIdentity(
  review: GoogleBusinessReview,
  placeId: string | null | undefined,
  index: number,
): string {
  const resourceId = review.name?.split("/").at(-1)?.trim();
  const id = review.reviewId?.trim() || resourceId;
  return id || `${placeId || "location"}-${index}`;
}

function mapReview(
  review: GoogleBusinessReview,
  placeId: string | null | undefined,
  index: number,
  fetchedAt: string,
): Review | null {
  const rating = mapStarRating(review.starRating);
  if (rating === null) return null;

  const isAnonymous = review.reviewer?.isAnonymous === true;
  const displayName = review.reviewer?.displayName?.trim();
  const profilePhotoUrl = isAnonymous
    ? undefined
    : review.reviewer?.profilePhotoUrl?.trim() || undefined;

  return {
    id: `google-business-${reviewIdentity(review, placeId, index)}`,
    reviewerName: isAnonymous
      ? "Anonymous Google Reviewer"
      : displayName || "Google Reviewer",
    rating,
    // Do not filter empty comments: Google permits rating-only reviews.
    reviewText: review.comment?.trim() || "",
    reviewDate: review.createTime ?? review.updateTime ?? fetchedAt,
    profilePhotoUrl,
    source: "Google",
  };
}

async function readPage(response: Response): Promise<GoogleBusinessReviewsPage> {
  const body = await response.text();
  let payload: GoogleBusinessReviewsPage = {};

  if (body) {
    try {
      payload = JSON.parse(body) as GoogleBusinessReviewsPage;
    } catch {
      if (response.ok) {
        throw new Error(
          "Google Business Profile returned an invalid reviews response.",
        );
      }
    }
  }

  if (!response.ok) {
    const detail = payload.error?.message?.trim();
    throw new Error(
      detail
        ? `Google Business Profile reviews request failed: ${detail}`
        : `Google Business Profile reviews request failed (${response.status}).`,
    );
  }

  return payload;
}

/**
 * Fetch every Google Business Profile review for one verified location.
 *
 * This uses the owner-authenticated Business Profile API rather than Places,
 * whose Place Details response only contains a small featured review sample.
 */
export async function fetchAllGoogleBusinessReviews({
  accessToken,
  accountName,
  locationName,
  placeId,
  businessName,
  businessUrl,
}: FetchGoogleBusinessReviewsOptions): Promise<ReviewsData> {
  const token = accessToken.trim();
  if (!token) {
    throw new Error("Google Business Profile access token is required.");
  }

  const parent = normalizeReviewsParent(accountName, locationName);
  const requestedPageTokens = new Set<string>();
  const rawReviews: GoogleBusinessReview[] = [];
  let pageToken: string | undefined;
  let averageRating: number | undefined;
  let reportedTotal = 0;
  let pageCount = 0;
  const deadline = Date.now() + GOOGLE_BUSINESS_REVIEWS_TIMEOUT_MS;

  while (true) {
    pageCount += 1;
    if (pageCount > GOOGLE_BUSINESS_REVIEWS_MAX_PAGES) {
      throw new Error(
        "Google Business Profile returned too many review pages to process safely.",
      );
    }
    if (pageToken) requestedPageTokens.add(pageToken);

    const url = new URL(
      `${GOOGLE_BUSINESS_API_BASE_URL}/${parent}/reviews`,
    );
    url.searchParams.set(
      "pageSize",
      String(GOOGLE_BUSINESS_REVIEWS_PAGE_SIZE),
    );
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Google Business Profile review sync timed out.");
    }
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(10_000, remainingMs)),
    });
    const page = await readPage(response);

    rawReviews.push(...(page.reviews ?? []));

    if (
      averageRating === undefined &&
      typeof page.averageRating === "number" &&
      Number.isFinite(page.averageRating)
    ) {
      averageRating = page.averageRating;
    }
    if (
      typeof page.totalReviewCount === "number" &&
      Number.isFinite(page.totalReviewCount)
    ) {
      reportedTotal = Math.max(reportedTotal, page.totalReviewCount);
    }

    const nextPageToken = page.nextPageToken?.trim();
    if (!nextPageToken) break;
    if (requestedPageTokens.has(nextPageToken)) {
      throw new Error(
        "Google Business Profile repeated a reviews page token before all reviews were fetched.",
      );
    }
    pageToken = nextPageToken;
  }

  const fetchedAt = new Date().toISOString();
  const seenReviewIds = new Set<string>();
  const reviews: Review[] = [];

  rawReviews.forEach((rawReview, index) => {
    const review = mapReview(rawReview, placeId?.trim(), index, fetchedAt);
    if (!review || seenReviewIds.has(review.id)) return;
    seenReviewIds.add(review.id);
    reviews.push(review);
  });

  const calculatedAverage =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
  const businessTitle = businessName.trim();

  const coverage =
    (reportedTotal === 0 && reviews.length === 0) ||
    reviews.length === reportedTotal
      ? "complete"
      : "partial";

  return {
    totalCount: Math.max(reportedTotal, reviews.length),
    averageRating: averageRating ?? calculatedAverage,
    source: "Google",
    reviews,
    coverage,
    provider: "google_business_profile",
    businessUrl:
      safeGoogleMapsUrl(businessUrl) ??
      (placeId?.trim()
        ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId.trim())}`
        : undefined),
    isLive: true,
    isCached: false,
    fetchedAt,
    attribution:
      coverage === "complete"
        ? businessTitle
          ? `Based on all Google reviews for ${businessTitle}.`
          : "Based on all Google reviews."
        : businessTitle
          ? `Based on ${reviews.length} of ${Math.max(reportedTotal, reviews.length)} Google reviews for ${businessTitle}.`
          : `Based on ${reviews.length} of ${Math.max(reportedTotal, reviews.length)} Google reviews.`,
  };
}
