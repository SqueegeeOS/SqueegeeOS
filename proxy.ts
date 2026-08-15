import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from "@/lib/admin/server-auth";
import { FIELD_SESSION_COOKIE_NAME } from "@/lib/field-operations/field-access-config";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const adminAuthorized = verifyAdminSessionToken(adminSession);

  if (pathname === "/tech/access" || pathname.startsWith("/tech/access/")) {
    return NextResponse.next();
  }

  if (pathname === "/tech" || pathname.startsWith("/tech/")) {
    // This is only an optimistic presence check. Every page and /api/field
    // route validates the revocable database session near the data source.
    const fieldSession = request.cookies.get(FIELD_SESSION_COOKIE_NAME)?.value;
    if (adminAuthorized || fieldSession) return NextResponse.next();

    const fieldSignInUrl = new URL("/tech/access", request.url);
    fieldSignInUrl.searchParams.set(
      "returnTo",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(fieldSignInUrl);
  }

  if (adminAuthorized) return NextResponse.next();

  const signInUrl = new URL("/hq", request.url);
  signInUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/hq/:path+",
    "/david/:path*",
    "/sales/:path*",
    "/employee/:path*",
    "/tech/:path*",
    "/properties/:path*",
    "/setup/:path*",
    "/experience/:path*",
    "/homecare/:path*",
  ],
};
