"use client";

import { useEffect, useState } from "react";
import type { GoogleReviewsApiResponse, ReviewsSectionProps } from "@/lib/reviews/types";
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
  const [response, setResponse] = useState<GoogleReviewsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/reviews/google");
        if (!res.ok) throw new Error("Failed to load reviews");
        const json = (await res.json()) as GoogleReviewsApiResponse;
        if (!cancelled) setResponse(json);
      } catch {
        if (!cancelled) {
          setResponse({
            status: "unavailable",
            data: null,
            message: "Google reviews temporarily unavailable.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
