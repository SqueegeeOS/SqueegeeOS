import type { ReviewsData } from "./types";

/** Empty fallback — never show fabricated testimonials as live reviews. */
export const approvedClientTestimonials: ReviewsData = {
  totalCount: 0,
  averageRating: 0,
  source: "Google",
  isSampleData: true,
  attribution: "Google reviews not configured",
  reviews: [],
};
