import { NextResponse } from "next/server";
import { GOOGLE_REVIEWS_CACHE_SECONDS } from "@/lib/reviews/config";
import { getGoogleReviewsResponse } from "@/lib/reviews/get-google-reviews";

export const revalidate = GOOGLE_REVIEWS_CACHE_SECONDS;

export async function GET() {
  const payload = await getGoogleReviewsResponse();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${GOOGLE_REVIEWS_CACHE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
