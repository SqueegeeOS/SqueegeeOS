import { NextResponse } from "next/server";
import { getGoogleReviewsResponse } from "@/lib/reviews/get-google-reviews";

// Provider credentials and the durable Google connection are runtime state.
// Keep this handler out of build-time prerendering; the response and inner
// provider fetches are still cached for eight hours below.
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getGoogleReviewsResponse();
  return NextResponse.json(payload, {
    headers: {
      // Connection changes must take effect immediately. GBP content is
      // cached only in the server-side tagged cache; never in a CDN/browser.
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
