import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import {
  getJobberConfigStatus,
  resolveJobberOAuthRedirectUri,
  suggestJobberOAuthRedirectUri,
} from "@/lib/care-operations/jobber-oauth-config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configuration = getJobberConfigStatus();
  let redirectUri = suggestJobberOAuthRedirectUri(request);
  try {
    redirectUri = resolveJobberOAuthRedirectUri(request);
  } catch {
    // Show the stable app-origin suggestion while still reporting configuration
    // as incomplete. OAuth itself will not start until the URI is explicit.
  }

  try {
    const connection = configuration.configured
      ? await readJobberConnectionStatus()
      : null;
    return NextResponse.json({ configuration, redirectUri, connection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    return NextResponse.json(
      { configuration, redirectUri, connection: null, error: message },
      { status: 503 },
    );
  }
}
