import { NextRequest, NextResponse } from "next/server";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendWelcomeEmail } from "@/lib/agreement/send-welcome-email";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import type { MembershipRowForPayment } from "@/lib/membership/load-membership-for-payment";
import { ensureMembershipObligations } from "@/lib/obligations/ensure-membership-obligations";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordWebsiteMembershipSale } from "@/lib/admin/record-website-membership-sale";
import type { WebsiteMembershipSaleActivationMode } from "@/lib/admin/website-membership-sales-types";

async function recordMembershipObligations(
  supabase: SupabaseClient,
  membership: MembershipRowForPayment,
  startedAt: string,
) {
  try {
    const result = await ensureMembershipObligations(supabase, {
      membershipId: membership.id,
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      visitsPerYear: membership.visits_per_year,
      startedAt,
    });

    if (result.created > 0) {
      console.info("[setup-payment] obligations generated", {
        membershipId: membership.id,
        created: result.created,
      });
    }
  } catch (error) {
    console.error("[setup-payment] obligation generation failed:", error);
  }
}

async function recordWebsiteSale(
  supabase: SupabaseClient,
  membershipId: string,
  paymentSetupCompletedAt: string,
  activationMode: WebsiteMembershipSaleActivationMode,
) {
  try {
    const result = await recordWebsiteMembershipSale(supabase, {
      membershipId,
      paymentSetupCompletedAt,
      soldAt: paymentSetupCompletedAt,
      activationMode,
    });

    if (result.recorded) {
      console.info("[setup-payment] website membership sale recorded", {
        membershipId,
        saleId: result.saleId,
      });
    }
  } catch (error) {
    console.error("[setup-payment] website membership sale failed:", error);
  }
}

/**
 * Activates membership after payment method is on file.
 * - Stripe mode: requires paymentMethodId + setupIntentId (verified server-side)
 * - Mock mode: only when Stripe is not configured (no card data stored)
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const presentationId =
      typeof body.presentationId === "string" ? body.presentationId : null;
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId : null;
    const paymentMethodId =
      typeof body.paymentMethodId === "string" ? body.paymentMethodId : null;
    const setupIntentId =
      typeof body.setupIntentId === "string" ? body.setupIntentId : null;

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

    if (membership.status === "active" && membership.payment_setup_completed_at) {
      const portalUrl = await getPortalAccessUrlForMembership(
        membership.id,
        req.nextUrl.origin,
      );
      await recordMembershipObligations(
        supabase,
        membership,
        membership.started_at ?? membership.payment_setup_completed_at,
      );
      await recordWebsiteSale(
        supabase,
        membership.id,
        membership.payment_setup_completed_at,
        isStripeServerEnabled() ? "stripe" : "mock",
      );
      return NextResponse.json({
        membershipId: membership.id,
        presentationId: membership.presentation_id,
        status: "active",
        onboardingStatus: "complete",
        mode: isStripeServerEnabled() ? "stripe" : "mock",
        alreadyActive: true,
        portalUrl,
      });
    }

    const stripeEnabled = isStripeServerEnabled();
    let stripePaymentMethodId: string | null = null;
    let stripeCustomerId = membership.stripe_customer_id;

    if (stripeEnabled) {
      if (!paymentMethodId || !setupIntentId) {
        return NextResponse.json(
          {
            error:
              "paymentMethodId and setupIntentId are required when Stripe is enabled",
          },
          { status: 400 },
        );
      }

      const stripe = getStripe();
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== "succeeded") {
        return NextResponse.json(
          { error: `SetupIntent not completed (status: ${setupIntent.status})` },
          { status: 400 },
        );
      }

      const intentMembershipId = setupIntent.metadata?.membership_id;
      if (intentMembershipId && intentMembershipId !== membership.id) {
        return NextResponse.json(
          { error: "SetupIntent does not match this membership" },
          { status: 400 },
        );
      }

      const intentPaymentMethod =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (intentPaymentMethod !== paymentMethodId) {
        return NextResponse.json(
          { error: "Payment method does not match SetupIntent" },
          { status: 400 },
        );
      }

      stripeCustomerId =
        typeof setupIntent.customer === "string"
          ? setupIntent.customer
          : setupIntent.customer?.id ?? stripeCustomerId;

      if (!stripeCustomerId) {
        return NextResponse.json(
          { error: "Stripe customer missing on SetupIntent" },
          { status: 400 },
        );
      }

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      stripePaymentMethodId = paymentMethodId;
    } else if (paymentMethodId || setupIntentId) {
      return NextResponse.json(
        { error: "Stripe is not configured — cannot save payment method" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const startedAt = membership.started_at ?? now;

    const { error: updateMembershipError } = await supabase
      .from("memberships")
      .update({
        status: "active",
        payment_setup_completed_at: now,
        started_at: startedAt,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: stripePaymentMethodId,
      })
      .eq("id", membership.id);

    if (updateMembershipError) {
      return NextResponse.json(
        { error: updateMembershipError.message },
        { status: 500 },
      );
    }

    await recordMembershipObligations(supabase, membership, startedAt);

    const resolvedPresentationId =
      presentationId ?? membership.presentation_id;

    if (resolvedPresentationId) {
      const { error: presentationError } = await supabase
        .from("presentations")
        .update({ onboarding_status: "complete" })
        .eq("id", resolvedPresentationId);

      if (presentationError) {
        console.error(
          "[setup-payment] Presentation update failed:",
          presentationError.message,
        );
      }
    }

    await recordWebsiteSale(
      supabase,
      membership.id,
      now,
      stripeEnabled ? "stripe" : "mock",
    );

    const portalUrl = await getPortalAccessUrlForMembership(
      membership.id,
      req.nextUrl.origin,
    );

    if (portalUrl) {
      const [{ data: homeowner }, { data: presentation }] = await Promise.all([
        supabase
          .from("homeowners")
          .select("full_name, email")
          .eq("id", membership.homeowner_id)
          .maybeSingle(),
        resolvedPresentationId
          ? supabase
              .from("presentations")
              .select("client_email, client_name")
              .eq("id", resolvedPresentationId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const memberEmail = resolveMemberEmail(
        presentation?.client_email as string | null | undefined,
        homeowner?.email as string | null | undefined,
      );
      const memberName =
        (presentation?.client_name as string | null | undefined)?.trim() ||
        (homeowner?.full_name as string | null | undefined)?.trim() ||
        "Member";

      if (memberEmail) {
        const welcomeEmail = await sendWelcomeEmail({
          to: memberEmail,
          name: memberName,
          portalUrl,
        });
        if (welcomeEmail.status !== "sent") {
          console.warn("[setup-payment] welcome email not sent", welcomeEmail);
        }
      }
    }

    return NextResponse.json({
      membershipId: membership.id,
      presentationId: resolvedPresentationId,
      status: "active",
      onboardingStatus: "complete",
      paymentSetupCompletedAt: now,
      mode: stripeEnabled ? "stripe" : "mock",
      portalUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to set up payment";
    console.error("[setup-payment] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
