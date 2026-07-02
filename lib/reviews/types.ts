export type ReviewSource = "Google";

export interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  profilePhotoUrl?: string;
  source: ReviewSource;
  /** Optional display context (e.g. neighborhood) — not from Google API */
  location?: string;
}

export interface ReviewsData {
  /** Total review count (e.g. 127 from Google) */
  totalCount: number;
  averageRating: number;
  source: ReviewSource;
  reviews: Review[];
  /** True when using illustrative sample data — show badge in UI */
  isSampleData?: boolean;
}

/** Subset used on marketing / Home Care Plan surfaces */
export interface ReviewsSectionProps {
  data: ReviewsData;
  /** Reviews to display; defaults to first items in `data.reviews` */
  featured?: Review[];
  title?: string;
}
