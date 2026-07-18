import { NextResponse } from "next/server";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";
import { claimMemberReferralReward } from "@/lib/referrals/claim";
import { getAvailableCareCreditCents } from "@/lib/referrals/rewards";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/**
 * Claim an earned referral reward. Membership is resolved ONLY from the
 * portal token; the token is never logged, stored, or forwarded. Claiming
 * is transactional and idempotent — refreshes, retries, and concurrent
 * clicks converge on one claim event and one balance.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      portalToken?: unknown;
      rewardId?: unknown;
      idempotencyKey?: unknown;
    } | null;

    const portalToken =
      typeof body?.portalToken === "string" ? body.portalToken.trim() : "";
    const rewardId =
      typeof body?.rewardId === "string" ? body.rewardId.trim() : "";
    const idempotencyKey =
      typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

    if (
      !portalToken ||
      !rewardId ||
      !idempotencyKey ||
      idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
      return NextResponse.json(
        { error: "portalToken, rewardId, and idempotencyKey are required" },
        { status: 400 },
      );
    }

    const access = await resolvePortalAccessByToken(portalToken);
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A malformed reward id can never belong to this member.
    if (!UUID_PATTERN.test(rewardId)) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    const result = await claimMemberReferralReward({
      membershipId: access.membershipId,
      rewardId,
      idempotencyKey,
    });

    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }
    if (result.outcome === "unclaimable") {
      return NextResponse.json(
        { error: "This reward can no longer be claimed" },
        { status: 409 },
      );
    }
    if (result.outcome === "unavailable") {
      return NextResponse.json(
        { error: "Claiming is temporarily unavailable" },
        { status: 503 },
      );
    }

    const availableCareCreditCents = await getAvailableCareCreditCents(
      access.membershipId,
    );

    return NextResponse.json({
      outcome: result.outcome,
      reward: {
        id: result.rewardId,
        label: result.label,
        status: result.status,
        valueCents: result.valueCents,
      },
      availableCareCreditCents,
      // Flipped only when the PR2 billing allocator AND the legacy
      // charge-path audit both pass independently.
      creditApplicationReady: false,
    });
  } catch (error) {
    // Server-side breadcrumb for incident diagnosis. The claim layer already
    // reduces DB errors to "claim_failed"; the token is never interpolated.
    console.error(
      "[portal-claim] claim request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    // Response stays detail-free: no token, no DB error, nothing to correlate.
    return NextResponse.json(
      { error: "Failed to claim reward" },
      { status: 500 },
    );
  }
}
