import type { ReviewsData } from "./types";

/**
 * Manually approved testimonials — used only when live Google reviews
 * are unavailable. Never presented as live Google review counts.
 */
export const approvedClientTestimonials: ReviewsData = {
  totalCount: 0,
  averageRating: 0,
  source: "Google",
  isSampleData: true,
  attribution: "Approved client testimonials",
  reviews: [
    {
      id: "testimonial-1",
      reviewerName: "Homeowner, Chico",
      rating: 5,
      reviewText:
        "They treated our home with real care. Every detail on our plan was specific — nothing generic.",
      reviewDate: "2026-05-12",
      source: "Google",
      location: "Chico",
    },
    {
      id: "testimonial-2",
      reviewerName: "Member, Canyon Oaks",
      rating: 5,
      reviewText:
        "We reviewed the care plan together before discussing anything else. That level of thoughtfulness is rare.",
      reviewDate: "2026-04-03",
      source: "Google",
      location: "Chico",
    },
    {
      id: "testimonial-3",
      reviewerName: "Preferred Care Member",
      rating: 5,
      reviewText:
        "Preferred Care was the right decision for our home. Consistent, proactive, and worth every season.",
      reviewDate: "2026-02-18",
      source: "Google",
      location: "Chico",
    },
  ],
};
