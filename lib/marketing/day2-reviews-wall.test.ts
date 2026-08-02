import { describe, expect, it } from "vitest";
import {
  getDay2ReviewAttribution,
  getDay2ReviewWallCopy,
  isDisplayableDay2Review,
} from "@/components/marketing/day2-reviews-wall";
import type { Review } from "@/lib/reviews/types";

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "review-1",
    reviewerName: "Google Customer",
    rating: 5,
    reviewText: "Great work.",
    reviewDate: "2026-08-01T00:00:00.000Z",
    source: "Google",
    ...overrides,
  };
}

describe("Day 2 complete Google review wall", () => {
  it("includes one- through five-star reviews without editorial filtering", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(isDisplayableDay2Review(review({ rating }))).toBe(true);
    }
  });

  it("includes rating-only Google reviews", () => {
    expect(isDisplayableDay2Review(review({ reviewText: "" }))).toBe(true);
  });

  it("rejects malformed ratings and nameless entries", () => {
    expect(isDisplayableDay2Review(review({ rating: 0 }))).toBe(false);
    expect(isDisplayableDay2Review(review({ rating: 6 }))).toBe(false);
    expect(isDisplayableDay2Review(review({ reviewerName: "" }))).toBe(false);
  });

  it("states partial coverage precisely without claiming every review", () => {
    const copy = getDay2ReviewWallCopy({
      coverage: "partial",
      displayedCount: 73,
      totalCount: 128,
      provider: "google_business_profile",
    });
    const renderedCopy = `${copy.countLabel} ${copy.description}`;

    expect(copy.countLabel).toBe("73 of 128 reviews synced");
    expect(renderedCopy).not.toMatch(/\b(all|every)\b/i);
  });

  it("uses compliant Google Maps preview attribution and disclosure", () => {
    const attribution = getDay2ReviewAttribution("google_places");
    const copy = getDay2ReviewWallCopy({
      coverage: "preview",
      displayedCount: 5,
      totalCount: 128,
      provider: "google_places",
    });

    expect(attribution).toEqual({
      label: "Google Maps",
      translate: "no",
      style: {
        fontSize: "12px",
        fontWeight: 400,
        letterSpacing: "normal",
      fontFamily: "Roboto, Arial, sans-serif",
        fontStyle: "normal",
        whiteSpace: "nowrap",
        color: "#1F1F1F",
      },
    });
    expect(copy.countLabel).toBe("5 of 128 reviews shown");
    expect(copy.orderingDisclosure).toMatch(/relevance/i);
    expect(copy.orderingDisclosure).toMatch(/no rating filter/i);
  });
});
