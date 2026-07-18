import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { backfillReferralCodes } from "@/lib/referrals/backfill";

/**
 * HQ-only referral-code backfill for active memberships that predate
 * activation-time issuance. Defaults to dry-run; pass { dryRun: false }
 * to issue codes. Idempotent — existing codes are never replaced.
 */
export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: unknown;
    };
    const dryRun = body.dryRun !== false;
    const result = await backfillReferralCodes({ dryRun });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: "Referral code backfill failed" },
      { status: 500 },
    );
  }
}
