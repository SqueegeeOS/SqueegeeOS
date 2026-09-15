import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { sendHostedMembershipPaymentLink } from "@/lib/membership/hosted-payment-handoff";
import { publicHostedPaymentHandoffError } from "@/lib/membership/hosted-payment-handoff-errors";
import { reconcileExistingStripeSetup } from "@/lib/membership/reconcile-existing-stripe-setup";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return response({ error: "Unauthorized" }, 401);
  }
  if (!isSupabaseConfigured()) {
    return response({ error: "Supabase is not configured" }, 503);
  }
  const { id } = await context.params;
  const membershipId = id.trim();
  if (!membershipId) {
    return response({ error: "Membership ID is required" }, 400);
  }

  try {
    const recovered = await reconcileExistingStripeSetup(membershipId);
    if (recovered) {
      return response({
        status: "reconciled",
        setupIntentId: recovered.setupIntentId,
        message:
          "Stripe already had this card. HomeAtlas matched it successfully; no duplicate email was sent.",
      });
    }
    const result = await sendHostedMembershipPaymentLink({
      membershipId,
      requestOrigin: new URL(request.url).origin,
    });
    return response({
      ...result,
      message:
        result.status === "already_sent"
          ? `A valid Stripe setup email was already accepted for ${result.recipientMasked}.`
          : `Stripe setup email accepted for ${result.recipientMasked}.`,
    });
  } catch (error) {
    console.error("[memberships/send-payment-link] failed", {
      membershipId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    const safe = publicHostedPaymentHandoffError(error);
    return response({ error: safe.message }, safe.status);
  }
}
