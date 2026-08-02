import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  getGoogleOAuthConfigStatus,
  isGoogleBusinessOAuthConfigured,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/reviews/google-oauth-config";
import {
  clearGoogleOAuthSession,
  readGoogleOAuthSession,
  readGoogleOAuthSessionForRevocation,
} from "@/lib/reviews/google-oauth-session";
import {
  disconnectGoogleBusinessConnection,
  readGoogleBusinessConnectionStatus,
} from "@/lib/reviews/google-business-connection-store";
import { isPublicFullGoogleReviewDisplayEnabled } from "@/lib/reviews/config";
import { getGoogleTokenEncryptionKeyStatus } from "@/lib/reviews/google-token-crypto";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) return unauthorized();

  const oauthConfig = getGoogleOAuthConfigStatus();
  const tokenEncryption = getGoogleTokenEncryptionKeyStatus();
  const configured =
    isGoogleBusinessOAuthConfigured() && tokenEncryption.ready;
  const session = configured ? await readGoogleOAuthSession() : null;
  const redirectUri = resolveGoogleOAuthRedirectUri(request);
  const durableConnection = await readGoogleBusinessConnectionStatus().catch(
    () => null,
  );
  const lastFullSyncTime = durableConnection?.lastFullSyncAt
    ? Date.parse(durableConnection.lastFullSyncAt)
    : Number.NaN;
  const fullReviewsFresh =
    Number.isFinite(lastFullSyncTime) &&
    Date.now() - lastFullSyncTime <= 24 * 60 * 60 * 1000;
  const fullReviewsConnected = Boolean(
    durableConnection?.connected &&
      fullReviewsFresh &&
      !durableConnection.lastErrorCode,
  );

  return NextResponse.json({
    configured,
    clientIdConfigured: oauthConfig.clientIdConfigured,
    clientSecretConfigured: oauthConfig.clientSecretConfigured,
    tokenEncryptionKeyConfigured: tokenEncryption.configured,
    tokenEncryptionKeyValid: tokenEncryption.valid,
    publicFullReviewsEnabled: isPublicFullGoogleReviewDisplayEnabled(),
    redirectUri,
    connected: Boolean(session?.accessToken),
    email: session?.email ?? null,
    ownerConnectionSaved: Boolean(durableConnection?.connected),
    fullReviewsConnected,
    fullReviewsStatus: durableConnection?.status ?? "not_connected",
    fullReviewsLocationName: durableConnection?.locationName ?? null,
    fullReviewCount: durableConnection?.lastFullReviewCount ?? null,
    fullReviewsLastSyncedAt: durableConnection?.lastFullSyncAt ?? null,
    fullReviewsLastErrorCode: durableConnection?.lastErrorCode ?? null,
  });
}

export async function DELETE(request: Request) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) return unauthorized();

  try {
    const temporarySession = await readGoogleOAuthSessionForRevocation();
    const result = await disconnectGoogleBusinessConnection({
      additionalToken:
        temporarySession?.refreshToken ?? temporarySession?.accessToken,
    });
    await clearGoogleOAuthSession();
    revalidateTag("google-reviews", { expire: 0 });
    return NextResponse.json({ disconnected: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "Google Business connection could not be disconnected." },
      { status: 500 },
    );
  }
}
