import { NextRequest, NextResponse } from "next/server";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import type { MembershipRowForPayment } from "@/lib/membership/load-membership-for-payment";
import { isMembershipActive } from "@/lib/membership/membership-status";
import {
  buildInitialWelcomeIdempotencyKey,
  sendMembershipWelcomeEmail,
} from "@/lib/membership/send-membership-welcome-email";
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
import { persistMembershipEnrollmentSavings } from "@/lib/membership/persist-membership-enrollment-savings";
import { authorizeMembershipAction } from "@/lib/membership/authorize-membership-action";
import { automaticBillingServiceMonth } from "@/lib/billing/automatic-billing-rules";

type ActivationRepairStep =
  | "obligations"
  | "website_sale"
  | "enrollment_savings"
  | "presentation_status"
  | "welcome_email";

async function recordActiveMemberCardUpdate(
  supabase: SupabaseClient,
  membershipId: string,
): Promise<{ billingRetryRequired: boolean; affectedOrderCount: number }> {
  const serviceMonth = automaticBillingServiceMonth(new Date());
  if (!serviceMonth) {
    return { billingRetryRequired: false, affectedOrderCount: 0 };
  }
  try {
    const orders = await supabase
      .from("billing_orders")
      .select("id")
      .eq("membership_id", membershipId)
      .eq("service_month", serviceMonth)
      .eq("execution_state", "needs_action")
      .neq("preview_state", "void");
    if (orders.error) throw new Error(orders.error.message);
    const orderIds = (orders.data ?? []).map((order) => order.id as string);
    if (orderIds.length > 0) {
      const events = await supabase.from("billing_order_events").insert(
        orderIds.map((billingOrderId) => ({
          billing_order_id: billingOrderId,
          event_type: "inputs_changed",
          actor: "member_card_update",
          reason:
            "Member saved a new card; the failed charge still requires an explicit founder retry",
          event_data: { service_month: serviceMonth },
        })),
      );
      if (events.error) throw new Error(events.error.message);
    }
    return {
      billingRetryRequired: orderIds.length > 0,
      affectedOrderCount: orderIds.length,
    };
  } catch (error) {
    // The card is already safely stored in Stripe and on the membership. Do not
    // report that operation as failed because a non-financial HQ audit note did.
    console.warn("[setup-payment] card-update billing audit skipped", {
      membershipId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { billingRetryRequired: false, affectedOrderCount: 0 };
  }
}

function publicWelcomeResult(result: AgreementEmailResult) {
  return {
    status: result.status,
    reason: result.status === "sent" ? null : (result.reason ?? "unknown"),
  };
}

async function attemptInitialWelcomeEmail(
  supabase: SupabaseClient,
  membership: MembershipRowForPayment,
  paymentSetupCompletedAt: string,
  portalUrl: string | null,
): Promise<AgreementEmailResult> {
  return sendMembershipWelcomeEmail(supabase, {
    membershipId: membership.id,
    homeownerId: membership.homeowner_id,
    presentationId: membership.presentation_id,
    portalUrl,
    idempotencyKey: buildInitialWelcomeIdempotencyKey(
      membership.id,
      paymentSetupCompletedAt,
    ),
  });
}

async function recordMembershipObligations(
  supabase: SupabaseClient,
  membership: MembershipRowForPayment,
  startedAt: string,
): Promise<ActivationRepairStep | null> {
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
    return null;
  } catch (error) {
    console.error("[setup-payment] obligation generation failed:", error);
    return "obligations";
  }
}

async function recordWebsiteSale(
  supabase: SupabaseClient,
  membershipId: string,
  paymentSetupCompletedAt: string,
  activationMode: WebsiteMembershipSaleActivationMode,
): Promise<ActivationRepairStep | null> {
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
    return result.recorded ||
      result.skippedReason === "already_recorded" ||
      result.skippedReason === "mock_activation_not_counted"
      ? null
      : "website_sale";
  } catch (error) {
    console.error("[setup-payment] website membership sale failed:", error);
    return "website_sale";
  }
}

async function lockEnrollmentSavings(
  supabase: SupabaseClient,
  membershipId: string,
  presentationId: string | null,
): Promise<ActivationRepairStep | null> {
  try {
    await persistMembershipEnrollmentSavings(
      supabase,
      membershipId,
      presentationId,
    );
    return null;
  } catch (error) {
    console.error("[setup-payment] enrollment savings lock failed:", error);
    return "enrollment_savings";
  }
}

async function finishActivationSideEffects(input: {
  supabase: SupabaseClient;
  membership: MembershipRowForPayment;
  paymentSetupCompletedAt: string;
  startedAt: string;
  presentationId: string | null;
  activationMode: WebsiteMembershipSaleActivationMode;
  portalUrl: string | null;
}): Promise<{
  welcomeEmail: AgreementEmailResult;
  repairNeeded: ActivationRepairStep[];
}> {
  const repairNeeded = (
    await Promise.all([
      recordMembershipObligations(
        input.supabase,
        input.membership,
        input.startedAt,
      ),
      recordWebsiteSale(
        input.supabase,
        input.membership.id,
        input.paymentSetupCompletedAt,
        input.activationMode,
      ),
      lockEnrollmentSavings(
        input.supabase,
        input.membership.id,
        input.presentationId,
      ),
    ])
  ).filter((step): step is ActivationRepairStep => step !== null);

  if (input.presentationId) {
    const { error } = await input.supabase
      .from("presentations")
      .update({ onboarding_status: "complete" })
      .eq("id", input.presentationId);
    if (error) {
      console.error("[setup-payment] presentation update failed:", error.message);
      repairNeeded.push("presentation_status");
    }
  }

  const welcomeEmail = await attemptInitialWelcomeEmail(
    input.supabase,
    input.membership,
    input.paymentSetupCompletedAt,
    input.portalUrl,
  );
  if (
    welcomeEmail.status !== "sent" &&
    welcomeEmail.reason !== "already_sent"
  ) {
    repairNeeded.push("welcome_email");
  }

  return { welcomeEmail, repairNeeded: [...new Set(repairNeeded)] };
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

    if (!(await authorizeMembershipAction(req, membership.id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paymentCompletedAt = membership.payment_setup_completed_at;
    const membershipAlreadyActive = Boolean(
      paymentCompletedAt &&
        isMembershipActive({
          status: membership.status,
          payment_setup_completed_at: paymentCompletedAt,
        }),
    );
    if (
      membershipAlreadyActive &&
      !paymentMethodId &&
      !setupIntentId
    ) {
      const activePaymentCompletedAt = paymentCompletedAt!;
      const portalUrl = await getPortalAccessUrlForMembership(
        membership.id,
        req.nextUrl.origin,
      );
      const activation = await finishActivationSideEffects({
        supabase,
        membership,
        paymentSetupCompletedAt: activePaymentCompletedAt,
        startedAt: membership.started_at ?? activePaymentCompletedAt,
        presentationId: membership.presentation_id,
        activationMode: isStripeServerEnabled() ? "stripe" : "mock",
        portalUrl,
      });
      return NextResponse.json({
        membershipId: membership.id,
        presentationId: membership.presentation_id,
        status: "active",
        onboardingStatus: "complete",
        mode: isStripeServerEnabled() ? "stripe" : "mock",
        alreadyActive: true,
        portalUrl,
        welcomeEmail: publicWelcomeResult(activation.welcomeEmail),
        onboardingRepairRequired: activation.repairNeeded.length > 0,
        repairNeeded: activation.repairNeeded,
      });
    }

    const stripeEnabled = isStripeServerEnabled();
    if (!stripeEnabled && process.env.ALLOW_MOCK_PAYMENT !== "true") {
      return NextResponse.json(
        { error: "Payment setup is not available" },
        { status: 503 },
      );
    }
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
      if (intentMembershipId !== membership.id) {
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

    if (membershipAlreadyActive && stripeEnabled) {
      const { error: updatePaymentMethodError } = await supabase
        .from("memberships")
        .update({
          stripe_customer_id: stripeCustomerId,
          stripe_payment_method_id: stripePaymentMethodId,
        })
        .eq("id", membership.id);
      if (updatePaymentMethodError) {
        throw new Error(updatePaymentMethodError.message);
      }
      const portalUrl = await getPortalAccessUrlForMembership(
        membership.id,
        req.nextUrl.origin,
      );
      const billingFollowUp = await recordActiveMemberCardUpdate(
        supabase,
        membership.id,
      );
      return NextResponse.json({
        membershipId: membership.id,
        presentationId: membership.presentation_id,
        status: "active",
        onboardingStatus: "complete",
        mode: "stripe",
        alreadyActive: true,
        paymentMethodUpdated: true,
        billingRetryRequired: billingFollowUp.billingRetryRequired,
        affectedBillingOrderCount: billingFollowUp.affectedOrderCount,
        portalUrl,
      });
    }

    const now = new Date().toISOString();
    const startedAt = membership.started_at ?? now;

    // Conditional write: only activate if payment_setup_completed_at is still null.
    // Concurrent retries after Stripe success converge on one activation write.
    const { data: activatedRows, error: updateMembershipError } = await supabase
      .from("memberships")
      .update({
        status: "active",
        payment_setup_completed_at: now,
        started_at: startedAt,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: stripePaymentMethodId,
      })
      .eq("id", membership.id)
      .is("payment_setup_completed_at", null)
      .select("id, payment_setup_completed_at");

    if (updateMembershipError) {
      return NextResponse.json(
        {
          error: updateMembershipError.message,
          recovery:
            "Stripe SetupIntent may already have succeeded. Retry this endpoint with the same setupIntentId — activation is idempotent once payment_setup_completed_at is set.",
          membershipId: membership.id,
          stripeCustomerId,
        },
        { status: 500 },
      );
    }

    const wonActivationRace = (activatedRows?.length ?? 0) > 0;
    const paymentSetupCompletedAt = wonActivationRace
      ? now
      : membership.payment_setup_completed_at ?? now;

    // If another request won the race, reload and run side-effect recovery.
    if (!wonActivationRace) {
      const reloaded = await loadMembershipForPayment(supabase, {
        membershipId: membership.id,
      });
      if (
        reloaded &&
        isMembershipActive({
          status: reloaded.status,
          payment_setup_completed_at: reloaded.payment_setup_completed_at,
        })
      ) {
        const portalUrl = await getPortalAccessUrlForMembership(
          reloaded.id,
          req.nextUrl.origin,
        );
        const activation = await finishActivationSideEffects({
          supabase,
          membership: reloaded,
          paymentSetupCompletedAt: reloaded.payment_setup_completed_at!,
          startedAt:
            reloaded.started_at ?? reloaded.payment_setup_completed_at!,
          presentationId: reloaded.presentation_id,
          activationMode: stripeEnabled ? "stripe" : "mock",
          portalUrl,
        });
        return NextResponse.json({
          membershipId: reloaded.id,
          presentationId: reloaded.presentation_id,
          status: "active",
          onboardingStatus: "complete",
          mode: stripeEnabled ? "stripe" : "mock",
          alreadyActive: true,
          portalUrl,
          welcomeEmail: publicWelcomeResult(activation.welcomeEmail),
          onboardingRepairRequired: activation.repairNeeded.length > 0,
          repairNeeded: activation.repairNeeded,
        });
      }
    }

    const resolvedPresentationId =
      presentationId ?? membership.presentation_id;

    const portalUrl = await getPortalAccessUrlForMembership(
      membership.id,
      req.nextUrl.origin,
    );

    const activation = await finishActivationSideEffects({
      supabase,
      membership: { ...membership, presentation_id: resolvedPresentationId },
      paymentSetupCompletedAt,
      startedAt,
      presentationId: resolvedPresentationId,
      activationMode: stripeEnabled ? "stripe" : "mock",
      portalUrl,
    });
    if (activation.welcomeEmail.status !== "sent") {
      console.warn("[setup-payment] welcome email not sent", {
        membershipId: membership.id,
        status: activation.welcomeEmail.status,
        reason: activation.welcomeEmail.reason,
      });
    }

    return NextResponse.json({
      membershipId: membership.id,
      presentationId: resolvedPresentationId,
      status: "active",
      onboardingStatus: "complete",
      paymentSetupCompletedAt,
      mode: stripeEnabled ? "stripe" : "mock",
      portalUrl,
      welcomeEmail: publicWelcomeResult(activation.welcomeEmail),
      onboardingRepairRequired: activation.repairNeeded.length > 0,
      repairNeeded: activation.repairNeeded,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to set up payment";
    console.error("[setup-payment] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
