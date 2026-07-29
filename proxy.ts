import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from "@/lib/admin/server-auth";

export function proxy(request: NextRequest) {
  const session = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (verifyAdminSessionToken(session)) {
    return NextResponse.next();
  }

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
    "/employee/:path*",
    "/tech/:path*",
    "/properties/:path*",
    "/setup/:path*",
    "/experience/:path*",
    "/homecare/:path*",
  ],
};
