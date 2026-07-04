import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { listManagedGoogleBusinesses } from "@/lib/reviews/google-business-profile";
import { readGoogleOAuthSession } from "@/lib/reviews/google-oauth-session";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const session = await readGoogleOAuthSession();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Not signed in with Google Business", businesses: [] },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const keyInfo = resolveSearchApiKey(searchParams.get("apiKey") ?? undefined);

  const result = await listManagedGoogleBusinesses(
    session.accessToken,
    keyInfo.apiKey,
  );

  logGoogleReviewsSetup("managed_businesses_listed", {
    email: session.email ?? null,
    businessCount: result.businesses.length,
    businesses: result.businesses
      .map(
        (item) =>
          `${item.name} (${item.placeId}) · ${item.rating ?? "?"}★ · ${item.reviewCount ?? "?"} reviews`,
      )
      .join(" | "),
  });

  return NextResponse.json({
    businesses: result.businesses,
    email: session.email ?? null,
    warning: result.error,
    serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
    apiKeySource: keyInfo.source,
  });
}
