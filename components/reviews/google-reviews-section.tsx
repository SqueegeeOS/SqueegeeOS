"use client";

import type { ReviewsSectionProps } from "@/lib/reviews/types";
import { useGoogleReviewsClient } from "@/lib/reviews/use-google-reviews-client";
import { ReviewsSection } from "./reviews-section";
import { ReviewsSectionSkeleton } from "./reviews-section-skeleton";

type GoogleReviewsSectionProps = Pick<
  ReviewsSectionProps,
  "featured" | "title"
> & {
  featuredLimit?: number;
};

export function GoogleReviewsSection({
  featured,
  title,
  featuredLimit = 3,
}: GoogleReviewsSectionProps) {
  const { response, loading } = useGoogleReviewsClient();

  if (loading) {
    return <ReviewsSectionSkeleton />;
  }

  if (!response?.data) {
    return (
      <ReviewsSection
        data={{
          totalCount: 0,
          averageRating: 0,
          source: "Google",
          reviews: [],
        }}
        title="Customer Reviews"
        apiStatus="unavailable"
        apiMessage={
          response?.message ?? "Google reviews temporarily unavailable."
        }
      />
    );
  }

  const featuredReviews =
    featured ?? response.data.reviews.slice(0, featuredLimit);

  return (
    <ReviewsSection
      data={response.data}
      featured={featuredReviews}
      title={title}
      apiStatus={response.status}
      apiMessage={response.message}
    />
  );
}
