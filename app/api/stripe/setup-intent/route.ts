import { NextRequest, NextResponse } from "next/server";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripePublishableKey } from "@/lib/stripe/client";
import { getStripe } from "@/lib/stripe/server";

/**
 * Creates a Stripe SetupIntent for card-on-file collection.
 * Finds or creates a Stripe Customer and persists stripe_customer_id on membership.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  if (!isStripeServerEnabled()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY in Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const presentationId =
      typeof body.presentationId === "string" ? body.presentationId : null;
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId : null;
    const memberName =
      typeof body.memberName === "string" ? body.memberName.trim() : "";
    const memberEmail = resolveMemberEmail(
      typeof body.memberEmail === "string" ? body.memberEmail : null,
    );

    if (!presentationId && !membershipId) {
      return NextResponse.json(
        { error: "presentationId or membershipId is required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();
    const membership = await loadMembershipForPayment(supabase, {
      presentationId,
      membershipId,
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found for this presentation" },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    let customerId = membership.stripe_customer_id;

    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ("deleted" in existing && existing.deleted) {
          customerId = null;
        }
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: memberEmail ?? undefined,
        name: memberName || undefined,
        metadata: {
          membership_id: membership.id,
          presentation_id: membership.presentation_id ?? "",
          homeowner_id: membership.homeowner_id,
          property_id: membership.property_id,
        },
      });
      customerId = customer.id;

      const { error: customerSaveError } = await supabase
        .from("memberships")
        .update({ stripe_customer_id: customerId })
        .eq("id", membership.id);

      if (customerSaveError) {
        console.error(
          "[stripe/setup-intent] Failed to save stripe_customer_id:",
          customerSaveError.message,
        );
      }
    } else if (memberEmail) {
      await stripe.customers.update(customerId, {
        email: memberEmail,
        ...(memberName ? { name: memberName } : {}),
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        membership_id: membership.id,
        presentation_id: membership.presentation_id ?? "",
      },
    });

    if (!setupIntent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId,
      publishableKey: getStripePublishableKey(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create setup intent";
    console.error("[stripe/setup-intent] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
