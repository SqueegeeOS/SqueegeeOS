import { NextResponse } from "next/server";
import { getMemberReferralSummary } from "@/lib/referrals/repository";

/** Member portal referral summary. Creates the member's code on first call. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      membershipId?: string;
      memberName?: string;
    };
    const membershipId = body.membershipId?.trim();
    if (!membershipId) {
      return NextResponse.json({ error: "membershipId required" }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const summary = await getMemberReferralSummary(
      membershipId,
      body.memberName?.trim() ?? "",
      origin,
    );
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}
