"use client";

import type { ReviewsSectionProps } from "@/lib/reviews/types";
import {
  buildReviewsTitle,
  ReviewCard,
  selectFeaturedReviews,
  SummaryStarRating,
} from "./review-card";
import {
  Eyebrow,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/home-care-plan/ui/primitives";

function ReviewsAttribution({
  data,
  apiStatus,
  apiMessage,
}: Pick<ReviewsSectionProps, "data" | "apiStatus" | "apiMessage">) {
  if (apiStatus === "unavailable") {
    return (
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {apiMessage ?? "Google reviews temporarily unavailable."}
        {data.isSampleData && (
          <span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-amber-300/80">
            Showing approved client testimonials
          </span>
        )}
      </p>
    );
  }

  if (data.isSampleData) {
    return (
      <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
        Approved client testimonials
      </p>
    );
  }

  return (
    <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-muted">
      {data.attribution ?? "Based on Google reviews."}
      {data.isCached && (
        <span className="mt-2 block text-muted/70">Cached for performance</span>
      )}
    </p>
  );
}

export function ReviewsSection({
  data,
  featured,
  title,
  apiStatus,
  apiMessage,
}: ReviewsSectionProps) {
  const displayed = featured ?? selectFeaturedReviews(data);

  if (displayed.length === 0) {
    return (
      <Section id="reviews" className="bg-surface/30">
        <div className="mx-auto max-w-xl text-center">
          <Eyebrow>Reviews</Eyebrow>
          <SectionTitle className="mx-auto mt-6">Customer reviews</SectionTitle>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            {apiMessage ??
              "Google reviews are not available yet. We will not show placeholder testimonials."}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section id="reviews" className="bg-surface/30">
      <div className="text-center">
        <Reveal>
          <Eyebrow>Reviews</Eyebrow>
          <SectionTitle className="mx-auto mt-6">
            {title ?? buildReviewsTitle(data)}
          </SectionTitle>
          <SummaryStarRating rating={data.averageRating} />
          <ReviewsAttribution
            data={data}
            apiStatus={apiStatus}
            apiMessage={apiMessage}
          />
        </Reveal>
      </div>

      <div className="mx-auto mt-20 max-w-4xl space-y-16 lg:mt-24 lg:space-y-20">
        {displayed.map((review, index) => (
          <Reveal key={review.id} delay={0.1 * index}>
            <ReviewCard review={review} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
