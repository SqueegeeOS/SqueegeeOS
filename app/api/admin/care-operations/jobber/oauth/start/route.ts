import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  buildJobberAuthorizationUrl,
  getJobberClientId,
  getJobberConfigStatus,
  resolveJobberOAuthRedirectUri,
} from "@/lib/care-operations/jobber-oauth-config";
import {
  createJobberPkce,
  createJobberOAuthState,
  writeJobberOAuthState,
} from "@/lib/care-operations/jobber-oauth-state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getJobberConfigStatus().configured) {
    return NextResponse.json(
      { error: "Jobber OAuth is not fully configured." },
      { status: 503 },
    );
  }

  try {
    const state = createJobberOAuthState();
    const { codeVerifier, codeChallenge } = createJobberPkce();
    await writeJobberOAuthState(state, codeVerifier);
    const redirectUri = resolveJobberOAuthRedirectUri(request);
    return NextResponse.json({
      authorizationUrl: buildJobberAuthorizationUrl({
        clientId: getJobberClientId(),
        redirectUri,
        state,
        codeChallenge,
      }),
      redirectUri,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth start failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
