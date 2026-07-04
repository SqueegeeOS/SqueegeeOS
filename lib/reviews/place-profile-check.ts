/** Approximate live profile for Noah's SqueegeeKing Google Business (Feb 2026). */
export const SQUEEGEEKING_PROFILE_HINT = {
  businessName: "SqueegeeKing",
  approximateReviewCount: 116,
  approximateRating: 5.0,
  reviewCountTolerance: 60,
  ratingMin: 4.85,
} as const;

export interface PlaceProfileAssessment {
  likelySqueegeeKing: boolean;
  nameMatches: boolean;
  reviewCountMatches: boolean;
  ratingMatches: boolean;
  mismatchReason: string | null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function assessPlaceProfileMatch(input: {
  businessName?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}): PlaceProfileAssessment {
  const name = input.businessName?.trim() ?? "";
  const normalized = normalizeName(name);
  const nameMatches =
    normalized.includes("squeegee") || normalized.includes("squeegeeking");

  const reviewCount = input.reviewCount ?? null;
  const rating = input.rating ?? null;

  const reviewCountMatches =
    reviewCount != null &&
    Math.abs(reviewCount - SQUEEGEEKING_PROFILE_HINT.approximateReviewCount) <=
      SQUEEGEEKING_PROFILE_HINT.reviewCountTolerance;

  const ratingMatches =
    rating != null && rating >= SQUEEGEEKING_PROFILE_HINT.ratingMin;

  const likelySqueegeeKing = nameMatches && reviewCountMatches && ratingMatches;

  let mismatchReason: string | null = null;
  if (!likelySqueegeeKing) {
    const parts: string[] = [];
    if (!nameMatches) {
      parts.push(
        `business name "${name || "unknown"}" does not look like SqueegeeKing`,
      );
    }
    if (reviewCount != null && !reviewCountMatches) {
      parts.push(
        `${reviewCount} reviews (expected ~${SQUEEGEEKING_PROFILE_HINT.approximateReviewCount})`,
      );
    }
    if (rating != null && !ratingMatches) {
      parts.push(
        `${rating.toFixed(1)} stars (expected ~${SQUEEGEEKING_PROFILE_HINT.approximateRating})`,
      );
    }
    mismatchReason = parts.join("; ");
  }

  return {
    likelySqueegeeKing,
    nameMatches,
    reviewCountMatches,
    ratingMatches,
    mismatchReason,
  };
}
