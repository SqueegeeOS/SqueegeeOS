"use client";

import type { ReviewsSectionProps } from "@/lib/reviews/types";
import {
  buildReviewsTitle,
  ReviewCard,
  selectFeaturedReviews,
} from "./review-card";
import {
  Eyebrow,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/home-care-plan/ui/primitives";

export function ReviewsSection({
  data,
  featured,
  title,
}: ReviewsSectionProps) {
  const displayed = featured ?? selectFeaturedReviews(data);

  return (
    <Section id="reviews" className="bg-surface/30">
      <div className="text-center">
        <Reveal>
          <Eyebrow>Reviews</Eyebrow>
          <SectionTitle className="mx-auto mt-6">
            {title ?? buildReviewsTitle(data)}
          </SectionTitle>
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-muted">
            {data.source} Reviews
            {data.isSampleData && (
              <span className="mt-2 block text-amber-300/70">
                Sample reviews for demonstration
              </span>
            )}
          </p>
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
