import { NextResponse } from "next/server";
import {
  claimSalesRepPhonePass,
  SALES_SESSION_COOKIE_NAME,
} from "@/lib/sales/sales-access";
import { salesReturnToForRep } from "@/lib/sales/sales-access-paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData();
  const token = form.get("token");

  try {
    const claimed = await claimSalesRepPhonePass(
      typeof token === "string" ? token : "",
    );
    const returnTo = salesReturnToForRep(
      form.get("returnTo"),
      claimed.actor.repSlug,
    );
    const response = NextResponse.redirect(
      new URL(returnTo, requestUrl.origin),
      303,
    );
    response.cookies.set({
      name: SALES_SESSION_COOKIE_NAME,
      value: claimed.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(claimed.actor.sessionExpiresAt),
      priority: "high",
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/sales/access?error=claim-failed", requestUrl.origin),
      303,
    );
  }
}
