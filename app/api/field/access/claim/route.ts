import { NextResponse } from "next/server";
import {
  claimTechnicianFieldPass,
  FIELD_SESSION_COOKIE_NAME,
} from "@/lib/field-operations/field-access";

export const runtime = "nodejs";

function safeReturnTo(value: FormDataEntryValue | null): string {
  return typeof value === "string" &&
    value.startsWith("/tech") &&
    !value.startsWith("/tech/access")
    ? value
    : "/tech";
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData();
  const token = form.get("token");
  const returnTo = safeReturnTo(form.get("returnTo"));

  try {
    const claimed = await claimTechnicianFieldPass(
      typeof token === "string" ? token : "",
    );
    const response = NextResponse.redirect(
      new URL(returnTo, requestUrl.origin),
      303,
    );
    response.cookies.set({
      name: FIELD_SESSION_COOKIE_NAME,
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
      new URL("/tech/access?error=claim-failed", requestUrl.origin),
      303,
    );
  }
}
