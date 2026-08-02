import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  getGoogleOAuthScopeString,
  GBP_REQUIRED_APIS,
} from "@/lib/reviews/google-oauth-config";
import { listManagedGoogleBusinesses } from "@/lib/reviews/google-business-profile";
import {
  readGoogleOAuthSession,
  writeGoogleOAuthSession,
} from "@/lib/reviews/google-oauth-session";
import { resolveOAuthEmail } from "@/lib/reviews/google-oauth-token-info";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) return unauthorized();

  const session = await readGoogleOAuthSession();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Not signed in with Google Business", businesses: [] },
      { status: 401 },
    );
  }

  const email = await resolveOAuthEmail(session.accessToken, session.email);
  if (email && email !== session.email) {
    await writeGoogleOAuthSession({ ...session, email });
  }

  const keyInfo = resolveSearchApiKey();

  const result = await listManagedGoogleBusinesses(
    session.accessToken,
    keyInfo.apiKey,
  );

  logGoogleReviewsSetup("managed_businesses_listed", {
    failureKind: result.diagnostic.failureKind,
    businessCount: result.businesses.length,
    accountsHttpStatus: result.diagnostic.accountsHttpStatus ?? null,
    accountCount: result.diagnostic.accountCount ?? null,
    locationCount: result.diagnostic.locationCount ?? null,
    hasBusinessManageScope: result.diagnostic.hasBusinessManageScope ?? null,
  });

  return NextResponse.json({
    businesses: result.businesses,
    email: email ?? null,
    warning: result.error,
    diagnostic: result.diagnostic,
    oauthScopesRequested: getGoogleOAuthScopeString(),
    requiredApis: GBP_REQUIRED_APIS,
    gbpApiAccessUrl: result.diagnostic.needsApiApproval
      ? "https://developers.google.com/my-business/content/prereqs#request-access"
      : undefined,
    serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
    apiKeySource: keyInfo.source,
  });
}
