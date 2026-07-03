import { NextResponse } from "next/server";
import { getGoogleReviewsResponse } from "@/lib/reviews/get-google-reviews";

/** 8 hours — must be a literal for Next.js segment config */
export const revalidate = 28800;

export async function GET() {
  const payload = await getGoogleReviewsResponse();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=28800, stale-while-revalidate=86400",
    },
  });
}
