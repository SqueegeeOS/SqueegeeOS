import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authorizeAdminRequest,
  getAdminAccessMode,
  issueAdminSessionToken,
} from "@/lib/admin/server-auth";
import { ADMIN_SESSION_TTL_MS } from "@/lib/admin/config";
import {
  checkAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
} from "@/lib/admin/unlock-rate-limit";

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many unlock attempts. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
      },
    },
  );
}

export async function POST(request: Request) {
  const suppliedPin = request.headers.get("x-admin-pin")?.trim();

  if (suppliedPin) {
    const currentLimit = await checkAdminUnlockRateLimit(request.headers);
    if (!currentLimit.allowed) {
      return rateLimited(currentLimit.retryAfterSeconds);
    }
  }

  const authorized = authorizeAdminRequest(request.headers);
  if (suppliedPin) {
    const updatedLimit = await recordAdminUnlockAttempt(
      request.headers,
      authorized,
    );
    if (!updatedLimit.allowed) {
      return rateLimited(updatedLimit.retryAfterSeconds);
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
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

  const response = NextResponse.json(
    { ok: true, mode },
    { headers: { "Cache-Control": "no-store" } },
  );
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
