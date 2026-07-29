import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { testGoogleReviewsConnection } from "@/lib/reviews/place-id-resolver";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { assessPlaceProfileMatch } from "@/lib/reviews/place-profile-check";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

export async function POST(request: Request) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    apiKey?: string;
    placeId?: string;
    source?: string;
    businessNameHint?: string;
  };

  const keyInfo = resolveSearchApiKey(body.apiKey);
  const placeId = body.placeId?.trim() ?? "";
  const result = await testGoogleReviewsConnection(keyInfo.apiKey, placeId);
  const assessment = assessPlaceProfileMatch({
    businessName: result.businessName ?? body.businessNameHint,
    rating: result.rating,
    reviewCount: result.reviewCount,
  });

  logGoogleReviewsSetup("connection_test", {
    source: body.source ?? "manual_test",
    placeId: placeId || null,
    businessName: result.businessName ?? body.businessNameHint ?? null,
    rating: result.rating,
    reviewCount: result.reviewCount,
    apiKeyValid: result.apiKeyValid,
    placeIdValid: result.placeIdValid,
    reviewsFound: result.reviewsFound,
    likelySqueegeeKing: assessment.likelySqueegeeKing,
    mismatchReason: assessment.mismatchReason,
  });

  return NextResponse.json({
    ...result,
    placeId,
    likelySqueegeeKing: assessment.likelySqueegeeKing,
    mismatchReason: assessment.mismatchReason,
    serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
    apiKeySource: keyInfo.source,
  });
}
