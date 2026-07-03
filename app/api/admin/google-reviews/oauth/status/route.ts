import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { isGoogleBusinessOAuthConfigured } from "@/lib/reviews/google-oauth-config";
import {
  clearGoogleOAuthSession,
  readGoogleOAuthSession,
} from "@/lib/reviews/google-oauth-session";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const configured = isGoogleBusinessOAuthConfigured();
  const session = configured ? await readGoogleOAuthSession() : null;

  return NextResponse.json({
    configured,
    connected: Boolean(session?.accessToken),
    email: session?.email ?? null,
  });
}

export async function DELETE(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  await clearGoogleOAuthSession();
  return NextResponse.json({ disconnected: true });
}
