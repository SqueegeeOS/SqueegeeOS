import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { sendHostedMembershipPaymentLink } from "@/lib/membership/hosted-payment-handoff";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function publicError(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : "unknown";
  const expected = [
    "Membership not found.",
    "This membership no longer needs a card setup link.",
    "The membership is missing its signed presentation binding.",
    "The signed customer record is incomplete.",
    "Completed standing billing authorization is required.",
    "This customer does not have a valid email address.",
    "This membership already completed card setup.",
    "Card setup retry limit reached. Review this member in HQ.",
    "Stripe is not configured for hosted card setup.",
    "The Stripe link is ready, but the email provider did not accept the message.",
  ];
  if (expected.includes(message)) {
    return {
      message,
      status: message.includes("not configured") ? 503 : 409,
    };
  }
  return {
    message: "The secure card setup email could not be sent. Review production health and try again.",
    status: 500,
  };
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
    const safe = publicError(error);
    return response({ error: safe.message }, safe.status);
  }
}
