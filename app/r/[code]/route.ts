import { NextResponse } from "next/server";
import { recordReferralVisit } from "@/lib/referrals/repository";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referrals/types";

/** Referral landing: log the visit, drop the attribution cookie, hand off to /request. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const url = new URL(request.url);

  const known = /^[A-Z0-9]{4,16}$/.test(normalized)
    ? await recordReferralVisit(normalized, {
        userAgent: request.headers.get("user-agent"),
        referer: request.headers.get("referer"),
      })
    : false;

  const response = NextResponse.redirect(new URL("/request", url.origin));
  if (known) {
    response.cookies.set(REFERRAL_COOKIE, normalized, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}
