import { describe, expect, it } from "vitest";
import {
  googleReviewRequestUrlForPlaceId,
  isSafeGoogleReviewRequestUrl,
} from "./review-request-url";

describe("Google review request destination", () => {
  it("builds a direct Google review link from a public Place ID", () => {
    expect(googleReviewRequestUrlForPlaceId("ChIJ_example-123")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ_example-123",
    );
  });

  it("rejects secrets, invalid IDs, and non-Google destinations", () => {
    expect(googleReviewRequestUrlForPlaceId("AIza-secret")).toBeNull();
    expect(googleReviewRequestUrlForPlaceId("not a place id")).toBeNull();
    expect(isSafeGoogleReviewRequestUrl("https://example.com/review")).toBe(false);
    expect(
      isSafeGoogleReviewRequestUrl(
        "https://search.google.com/local/writereview?placeid=ChIJ_example",
      ),
    ).toBe(true);
  });
});
