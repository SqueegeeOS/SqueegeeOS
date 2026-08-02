import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  getFreshGoogleBusinessConnection,
  recordGoogleBusinessSyncResult,
} from "@/lib/reviews/google-business-connection-store";
import { fetchAllGoogleBusinessReviews } from "@/lib/reviews/google-business-reviews";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connection: Awaited<ReturnType<typeof getFreshGoogleBusinessConnection>> | null =
    null;
  try {
    connection = await getFreshGoogleBusinessConnection();
    const data = await fetchAllGoogleBusinessReviews({
      accessToken: connection.accessToken,
      accountName: connection.identity.accountName,
      locationName: connection.identity.locationName,
      placeId: connection.identity.placeId,
      businessName: connection.identity.locationTitle,
    });
    const complete = data.coverage === "complete";
    const recorded = await recordGoogleBusinessSyncResult({
      reviewCount: data.reviews.length,
      errorCode: complete ? undefined : "google_business_reviews_partial",
      connectionRevision: connection.connectionRevision,
    });
    if (!recorded) {
      return NextResponse.json(
        { error: "The Google Business connection changed during sync." },
        { status: 409 },
      );
    }

    revalidateTag("google-reviews", { expire: 0 });
    return NextResponse.json({
      synced: true,
      complete,
      coverage: data.coverage,
      reviewCount: data.reviews.length,
      reportedTotal: data.totalCount,
      fetchedAt: data.fetchedAt,
    });
  } catch (error) {
    if (connection) {
      await recordGoogleBusinessSyncResult({
        errorCode: "google_business_reviews_unavailable",
        connectionRevision: connection.connectionRevision,
      });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Business review sync failed.",
      },
      { status: 502 },
    );
  }
}
