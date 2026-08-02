import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllGoogleBusinessReviews } from "./google-business-reviews";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const baseOptions = {
  accessToken: "owner-oauth-token",
  accountName: "accounts/123",
  locationName: "locations/456",
  placeId: "ChIJ-public-place-id",
  businessName: "SqueegeeKing",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAllGoogleBusinessReviews", () => {
  it("fetches every page at pageSize 50 and maps every star rating", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          averageRating: 3.5,
          totalReviewCount: 6,
          nextPageToken: "next token/+",
          reviews: [
            {
              reviewId: "one",
              reviewer: { displayName: "One Star" },
              starRating: "ONE",
              comment: "One",
              createTime: "2026-01-01T00:00:00Z",
            },
            {
              reviewId: "two",
              reviewer: { displayName: "Two Star" },
              starRating: "TWO",
              comment: "Two",
              createTime: "2026-01-02T00:00:00Z",
            },
            {
              reviewId: "three",
              reviewer: { displayName: "Three Star" },
              starRating: "THREE",
              comment: "Three",
              createTime: "2026-01-03T00:00:00Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          averageRating: 3.5,
          totalReviewCount: 6,
          reviews: [
            {
              reviewId: "four",
              reviewer: { displayName: "Four Star" },
              starRating: "FOUR",
              comment: "Four",
              createTime: "2026-01-04T00:00:00Z",
            },
            {
              reviewId: "five-rating-only",
              reviewer: {
                displayName: "Five Star",
                profilePhotoUrl: "https://example.com/five.jpg",
              },
              starRating: "FIVE",
              createTime: "2026-01-05T00:00:00Z",
            },
            {
              name: "accounts/123/locations/456/reviews/anonymous",
              reviewer: {
                displayName: "Hidden Name",
                profilePhotoUrl: "https://example.com/hidden.jpg",
                isAnonymous: true,
              },
              starRating: 5,
              comment: "Anonymous",
              updateTime: "2026-01-06T00:00:00Z",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllGoogleBusinessReviews(baseOptions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(firstUrl.origin + firstUrl.pathname).toBe(
      "https://mybusiness.googleapis.com/v4/accounts/123/locations/456/reviews",
    );
    expect(firstUrl.searchParams.get("pageSize")).toBe("50");
    expect(firstUrl.searchParams.get("orderBy")).toBe("updateTime desc");
    expect(firstUrl.searchParams.has("pageToken")).toBe(false);
    expect(secondUrl.searchParams.get("pageSize")).toBe("50");
    expect(secondUrl.searchParams.get("pageToken")).toBe("next token/+");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer owner-oauth-token",
      },
    });
    expect(result.totalCount).toBe(6);
    expect(result.averageRating).toBe(3.5);
    expect(result.coverage).toBe("complete");
    expect(result.provider).toBe("google_business_profile");
    expect(result.reviews.map((review) => review.rating)).toEqual([
      1, 2, 3, 4, 5, 5,
    ]);
    expect(result.reviews[4]).toMatchObject({
      id: "google-business-five-rating-only",
      reviewText: "",
      reviewerName: "Five Star",
    });
    expect(result.reviews[5]).toMatchObject({
      id: "google-business-anonymous",
      reviewerName: "Anonymous Google Reviewer",
      reviewDate: "2026-01-06T00:00:00Z",
    });
    expect(result.reviews[5].profilePhotoUrl).toBeUndefined();
    expect(result.attribution).toBe(
      "Based on all Google reviews for SqueegeeKing.",
    );
  });

  it("accepts a fully qualified location resource name", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ reviews: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAllGoogleBusinessReviews({
      ...baseOptions,
      locationName: "accounts/123/locations/456",
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/v4/accounts/123/locations/456/reviews?pageSize=50",
    );
  });

  it("deduplicates overlapping pages without dropping rating-only reviews", async () => {
    const repeatedReview = {
      reviewId: "same-review",
      reviewer: { displayName: "Rating Only" },
      starRating: "FIVE",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          reviews: [repeatedReview],
          nextPageToken: "page-2",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ reviews: [repeatedReview] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllGoogleBusinessReviews(baseOptions);

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].reviewText).toBe("");
  });

  it("fails instead of looping when Google repeats a page token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ reviews: [], nextPageToken: "repeated" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ reviews: [], nextPageToken: "repeated" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllGoogleBusinessReviews(baseOptions)).rejects.toThrow(
      "repeated a reviews page token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the Google API error without exposing the access token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { error: { message: "Location is not verified." } },
        403,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchAllGoogleBusinessReviews(baseOptions);
    await expect(promise).rejects.toThrow("Location is not verified.");
    await expect(promise).rejects.not.toThrow("owner-oauth-token");
  });

  it("rejects a fully qualified location from a different account", async () => {
    await expect(
      fetchAllGoogleBusinessReviews({
        ...baseOptions,
        locationName: "accounts/999/locations/456",
      }),
    ).rejects.toThrow("does not belong to the selected account");
  });
});
