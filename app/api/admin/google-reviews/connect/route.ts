import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  recordGoogleBusinessSyncResult,
  saveGoogleBusinessConnection,
} from "@/lib/reviews/google-business-connection-store";
import { fetchAllGoogleBusinessReviews } from "@/lib/reviews/google-business-reviews";
import { listManagedGoogleBusinesses } from "@/lib/reviews/google-business-profile";
import {
  clearGoogleOAuthSession,
  readGoogleOAuthSession,
} from "@/lib/reviews/google-oauth-session";
import { resolveOAuthEmail } from "@/lib/reviews/google-oauth-token-info";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

interface ConnectRequestBody {
  accountResourceName?: string;
  locationResourceName?: string;
  placeId?: string;
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();

  const session = await readGoogleOAuthSession();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Reconnect Google Business before enabling all reviews." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as ConnectRequestBody | null;
  const accountResourceName = body?.accountResourceName?.trim();
  const locationResourceName = body?.locationResourceName?.trim();
  const placeId = body?.placeId?.trim() || null;
  if (!accountResourceName || !locationResourceName) {
    return NextResponse.json(
      { error: "Select a verified Google Business Profile location." },
      { status: 400 },
    );
  }

  try {
    const oauthEmail = await resolveOAuthEmail(
      session.accessToken,
      session.email,
    );
    if (!oauthEmail) {
      return NextResponse.json(
        { error: "Google account identity could not be verified. Sign in again." },
        { status: 401 },
      );
    }

    const keyInfo = resolveSearchApiKey();
    const managed = await listManagedGoogleBusinesses(
      session.accessToken,
      keyInfo.apiKey,
    );
    const selected = managed.businesses.find(
      (business) =>
        business.accountResourceName === accountResourceName &&
        business.locationResourceName === locationResourceName &&
        (!placeId || !business.placeId || business.placeId === placeId),
    );
    if (!selected) {
      return NextResponse.json(
        { error: "That location was not returned by the connected Google account." },
        { status: 403 },
      );
    }

    const { tokenGeneration, connectionRevision } =
      await saveGoogleBusinessConnection({
      identity: {
        accountName: accountResourceName,
        locationName: locationResourceName,
        locationTitle: "SqueegeeKing",
        placeId: selected.placeId || null,
        oauthEmail,
      },
      session,
      });

    let fullReviewCount: number | null = null;
    let fullSyncReady = false;
    let warning: string | undefined;
    try {
      const reviews = await fetchAllGoogleBusinessReviews({
        accessToken: session.accessToken,
        accountName: accountResourceName,
        locationName: locationResourceName,
        placeId: selected.placeId || null,
        businessName: selected.name,
        businessUrl: selected.googleMapsUrl,
      });
      fullReviewCount = reviews.reviews.length;
      fullSyncReady = reviews.coverage === "complete";
      if (!fullSyncReady) {
        warning = `Google returned ${fullReviewCount} of ${reviews.totalCount} reviews. The connection is saved; use Sync owner reviews to retry.`;
      }
      const recorded = await recordGoogleBusinessSyncResult({
        reviewCount: fullReviewCount,
        errorCode: fullSyncReady
          ? undefined
          : "google_business_reviews_partial",
        tokenGeneration,
        connectionRevision,
      });
      if (!recorded) {
        return NextResponse.json(
          { error: "A newer Google Business connection replaced this request." },
          { status: 409 },
        );
      }
    } catch (syncError) {
      warning =
        syncError instanceof Error
          ? syncError.message
          : "Google Business review access still needs approval.";
      const recorded = await recordGoogleBusinessSyncResult({
        errorCode: "google_business_reviews_unavailable",
        tokenGeneration,
        connectionRevision,
      });
      if (!recorded) {
        return NextResponse.json(
          { error: "A newer Google Business connection replaced this request." },
          { status: 409 },
        );
      }
    }

    await clearGoogleOAuthSession();
    revalidateTag("google-reviews", { expire: 0 });
    return NextResponse.json({
      connected: true,
      fullSyncReady,
      fullReviewCount,
      warning,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google Business connection failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
