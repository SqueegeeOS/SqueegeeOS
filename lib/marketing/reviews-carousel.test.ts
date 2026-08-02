import { describe, expect, it } from "vitest";
import {
  getNextReviewScrollLeft,
  shouldAutoAdvanceReviews,
} from "@/components/marketing/reviews-carousel";

describe("review carousel", () => {
  it("advances by a visible page and clamps at the final card", () => {
    expect(
      getNextReviewScrollLeft({
        scrollLeft: 0,
        clientWidth: 800,
        scrollWidth: 2_100,
      }),
    ).toBe(768);

    expect(
      getNextReviewScrollLeft({
        scrollLeft: 1_000,
        clientWidth: 800,
        scrollWidth: 2_100,
      }),
    ).toBe(1_300);
  });

  it("wraps to the first review after reaching the end", () => {
    expect(
      getNextReviewScrollLeft({
        scrollLeft: 1_298,
        clientWidth: 800,
        scrollWidth: 2_100,
      }),
    ).toBe(0);
  });

  it("does not run for reduced motion, one card, or a rail without overflow", () => {
    expect(
      shouldAutoAdvanceReviews({
        hasOverflow: true,
        itemCount: 4,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      shouldAutoAdvanceReviews({
        hasOverflow: true,
        itemCount: 4,
        reducedMotion: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoAdvanceReviews({
        hasOverflow: true,
        itemCount: 1,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoAdvanceReviews({
        hasOverflow: false,
        itemCount: 4,
        reducedMotion: false,
      }),
    ).toBe(false);
  });
});
