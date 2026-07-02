import type { ReviewsData } from "./types";

/**
 * Sample Google reviews for layout and development.
 * Replace with live data from Google Business Profile API.
 * Reviewer names are illustrative — not stock photos or impersonated people.
 */
export const squeegeekingGoogleReviews: ReviewsData = {
  totalCount: 127,
  averageRating: 5,
  source: "Google",
  isSampleData: true,
  reviews: [
    {
      id: "google-1",
      reviewerName: "Homeowner, Chico",
      rating: 5,
      reviewText:
        "They treated our home with real care. Every detail on our plan was specific — nothing generic.",
      reviewDate: "2026-05-12",
      source: "Google",
      location: "Chico",
    },
    {
      id: "google-2",
      reviewerName: "Member, Canyon Oaks",
      rating: 5,
      reviewText:
        "We reviewed the care plan together before discussing anything else. That level of thoughtfulness is rare.",
      reviewDate: "2026-04-03",
      source: "Google",
      location: "Chico",
    },
    {
      id: "google-3",
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
