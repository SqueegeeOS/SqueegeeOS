import { NextResponse } from "next/server";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";
import { getMemberReferralSummary } from "@/lib/referrals/repository";

/** Member portal referral summary. Creates the member's code on first call. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      portalToken?: string;
    };
    const portalToken = body.portalToken?.trim();
    if (!portalToken) {
      return NextResponse.json({ error: "portalToken required" }, { status: 400 });
    }

    const access = await resolvePortalAccessByToken(portalToken);
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = new URL(request.url).origin;
    const summary = await getMemberReferralSummary(
      access.membershipId,
      access.memberName,
      origin,
    );
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}
