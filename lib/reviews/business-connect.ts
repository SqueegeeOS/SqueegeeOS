import type { PlaceSearchCandidate } from "./place-id-resolver";

export interface BusinessConnectOption {
  placeId: string;
  name: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  locationLabel?: string;
  isServiceAreaBusiness?: boolean;
  isVerified?: boolean;
  website?: string;
  source: "google_business" | "places_search";
}

export function fromPlaceSearchCandidate(
  candidate: PlaceSearchCandidate,
): BusinessConnectOption {
  return {
    placeId: candidate.placeId,
    name: candidate.name,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    locationLabel: candidate.locationLabel,
    isServiceAreaBusiness: candidate.isServiceAreaBusiness,
    website: candidate.website,
    source: "places_search",
  };
}

export function formatStarRating(rating?: number): string {
  if (!rating || rating <= 0) return "";
  const rounded = Math.round(rating);
  return `${"★".repeat(Math.min(5, rounded))} ${rating.toFixed(1)}`;
}
