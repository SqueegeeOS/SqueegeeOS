import { NextResponse } from "next/server";
import { SALES_SESSION_COOKIE_NAME } from "@/lib/sales/sales-access-config";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/sales/access", request.url),
    303,
  );
  response.cookies.set({
    name: SALES_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
