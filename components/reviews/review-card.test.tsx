import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewCard } from "@/components/reviews/review-card";
import type { Review } from "@/lib/reviews/types";

const placesReview: Review = {
  id: "places-review",
  reviewerName: "Google Reviewer",
  rating: 2,
  reviewText: "The complete review text remains visible.",
  reviewDate: "2026-07-19T00:00:00.000Z",
  relativeDate: "2 weeks ago",
  profilePhotoUrl: "https://example.com/photo.jpg",
  reviewerProfileUrl: "https://www.google.com/maps/contrib/reviewer",
  reviewUrl: "https://www.google.com/maps/reviews/review-id",
  source: "Google",
};

describe("ReviewCard", () => {
  it("renders compliant Google Maps attribution and reviewer links", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        review={placesReview}
        provider="google_places"
        businessUrl="https://www.google.com/maps/place/business"
      />,
    );

    expect(html).toContain("The complete review text remains visible.");
    expect(html).toContain("Google Maps");
    expect(html).toContain("translate=\"no\"");
    expect(html).toContain("text-xs");
    expect(html).toContain("font-normal");
    expect(html).toContain("normal-case");
    expect(html).toContain("tracking-normal");
    expect(html).toContain(placesReview.reviewerProfileUrl!);
    expect(html).toContain(placesReview.reviewUrl!);
    expect(html).toContain(placesReview.profilePhotoUrl!);
  });

  it("keeps rating-only reviews visible without inventing a quote", () => {
    const html = renderToStaticMarkup(
      <ReviewCard review={{ ...placesReview, reviewText: "" }} />,
    );

    expect(html).toContain("Rating-only review");
    expect(html).not.toContain("&ldquo;&rdquo;");
  });
});
