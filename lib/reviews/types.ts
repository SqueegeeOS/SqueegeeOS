export type ReviewSource = "Google";

export type GoogleReviewsStatus = "live" | "cached" | "fallback" | "unavailable";

export interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  /** Human-readable relative date from Google when available */
  relativeDate?: string;
  profilePhotoUrl?: string;
  source: ReviewSource;
  /** Optional display context (e.g. neighborhood) — not from Google API */
  location?: string;
}

export interface ReviewsData {
  totalCount: number;
  averageRating: number;
  source: ReviewSource;
  reviews: Review[];
  /** True when using manually approved testimonials */
  isSampleData?: boolean;
  /** True when fetched from Google Places API */
  isLive?: boolean;
  /** True when served from server cache */
  isCached?: boolean;
  fetchedAt?: string;
  attribution?: string;
}

export interface GoogleReviewsApiResponse {
  status: GoogleReviewsStatus;
  data: ReviewsData | null;
  message?: string;
  fetchedAt?: string;
}

/** Subset used on marketing / Home Care Plan surfaces */
export interface ReviewsSectionProps {
  data: ReviewsData;
  /** Reviews to display; defaults to first items in `data.reviews` */
  featured?: Review[];
  title?: string;
  /** API status for attribution / fallback messaging */
  apiStatus?: GoogleReviewsStatus;
  apiMessage?: string;
}
