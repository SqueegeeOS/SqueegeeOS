import type { ReviewsData } from "@/lib/reviews/types";

/** Placeholder on plan records — live reviews load via /api/reviews/google */
export const emptyPlanReviews: ReviewsData = {
  totalCount: 0,
  averageRating: 0,
  source: "Google",
  reviews: [],
};
