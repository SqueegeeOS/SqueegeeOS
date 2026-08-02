import { describe, expect, it } from "vitest";
import { isDisplayableRightwayReview } from "@/components/marketing/rightway-extras";
import type { Review } from "@/lib/reviews/types";

describe("isDisplayableRightwayReview", () => {
  it("keeps all valid Google ratings and rating-only reviews", () => {
    const review: Review = {
      id: "rating-only",
      reviewerName: "Google Reviewer",
      rating: 1,
      reviewText: "",
      reviewDate: "2026-07-19T00:00:00.000Z",
      source: "Google",
    };

    expect(isDisplayableRightwayReview(review)).toBe(true);
    expect(isDisplayableRightwayReview({ ...review, rating: 5 })).toBe(true);
    expect(isDisplayableRightwayReview({ ...review, rating: 0 })).toBe(false);
    expect(
      isDisplayableRightwayReview({ ...review, reviewerName: "" }),
    ).toBe(false);
  });
});
