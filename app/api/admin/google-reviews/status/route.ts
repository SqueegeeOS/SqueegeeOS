import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  getGoogleMapsApiKey,
  getGooglePlaceId,
  isGoogleReviewsConfigured,
} from "@/lib/reviews/config";
import { fetchPlaceRatingSummary } from "@/lib/reviews/google-places";
import {
  assessPlaceProfileMatch,
  SQUEEGEEKING_PROFILE_HINT,
} from "@/lib/reviews/place-profile-check";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const placeId = getGooglePlaceId();
  const apiKey = getGoogleMapsApiKey();
  const configured = isGoogleReviewsConfigured();

  if (!configured || !placeId || !apiKey) {
    return NextResponse.json({
      configured: false,
      placeId: placeId ?? null,
      businessName: null,
      rating: null,
      reviewCount: null,
      likelySqueegeeKing: false,
      mismatchReason: "GOOGLE_PLACE_ID or GOOGLE_MAPS_API_KEY is not set.",
      expected: SQUEEGEEKING_PROFILE_HINT,
    });
  }

  const summary = await fetchPlaceRatingSummary(apiKey, placeId);
  const assessment = assessPlaceProfileMatch({
    businessName: summary.businessName,
    rating: summary.rating,
    reviewCount: summary.reviewCount,
  });

  logGoogleReviewsSetup("production_place_checked", {
    placeId,
    businessName: summary.businessName ?? null,
    rating: summary.rating ?? null,
    reviewCount: summary.reviewCount ?? null,
    likelySqueegeeKing: assessment.likelySqueegeeKing,
    mismatchReason: assessment.mismatchReason,
  });

  return NextResponse.json({
    configured: true,
    placeId,
    businessName: summary.businessName ?? null,
    rating: summary.rating ?? null,
    reviewCount: summary.reviewCount ?? null,
    likelySqueegeeKing: assessment.likelySqueegeeKing,
    mismatchReason: assessment.mismatchReason,
    expected: SQUEEGEEKING_PROFILE_HINT,
  });
}
