import { NextResponse } from "next/server";
import { sendHostedMembershipPaymentLink } from "@/lib/membership/hosted-payment-handoff";
import { publicHostedPaymentHandoffError } from "@/lib/membership/hosted-payment-handoff-errors";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";
import { getPresentation } from "@/lib/presentations/repository";
import { authorizeSalesPresentationRequest } from "@/lib/sales/sales-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await authorizeSalesPresentationRequest(request.headers, id);
  if (!actor) {
    return response({ error: "Unauthorized" }, 401);
  }
  if (!isSupabaseConfigured()) {
    return response({ error: "Supabase is not configured" }, 503);
  }

  try {
    const presentation = await getPresentation(id);
    if (!presentation) {
      return response({ error: "Presentation not found." }, 404);
    }
    if (presentation.status !== "signed" || !presentation.membershipId) {
      return response(
        { error: "Finish the signed agreement before emailing card setup." },
        409,
      );
    }

    const result = await sendHostedMembershipPaymentLink({
      membershipId: presentation.membershipId,
      requestOrigin: new URL(request.url).origin,
      actor:
        actor.kind === "sales_rep"
          ? `sales_rep:${actor.repSlug}`
          : "homeatlas_hq",
    });
    return response({
      ...result,
      message:
        result.status === "already_sent"
          ? `A valid Stripe setup email was already accepted for ${result.recipientMasked}.`
          : `Stripe setup email accepted for ${result.recipientMasked}.`,
    });
  } catch (error) {
    console.error("[presentations/send-payment-link] failed", {
      presentationId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    const safe = publicHostedPaymentHandoffError(error);
    return response({ error: safe.message }, safe.status);
  }
}
