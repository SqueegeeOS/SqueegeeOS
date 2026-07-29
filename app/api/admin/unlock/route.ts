import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authorizeAdminRequest,
  getAdminAccessMode,
  issueAdminSessionToken,
} from "@/lib/admin/server-auth";
import { ADMIN_SESSION_TTL_MS } from "@/lib/admin/config";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = getAdminAccessMode();
  if (!mode) {
    return NextResponse.json(
      { error: "Admin access is not configured" },
      { status: 503 },
    );
  }

  const sessionToken = issueAdminSessionToken();
  if (!sessionToken) {
    return NextResponse.json(
      { error: "Admin access is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, mode });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    priority: "high",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
