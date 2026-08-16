import "server-only";

import type Stripe from "stripe";
import { recordWebsiteMembershipSale } from "@/lib/admin/record-website-membership-sale";
import { ensureMembershipObligations } from "@/lib/obligations/ensure-membership-obligations";
import {
  buildInitialWelcomeIdempotencyKey,
  sendMembershipWelcomeEmail,
} from "@/lib/membership/send-membership-welcome-email";
import { persistMembershipEnrollmentSavings } from "@/lib/membership/persist-membership-enrollment-savings";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { syncMembershipSalesAttributionLifecycle } from "@/lib/sales/attribution-lifecycle-server";
import { getStripe } from "@/lib/stripe/server";
import type { EnrollmentPacketRow } from "./types";

type RepairStep =
  | "obligations"
  | "website_sale"
  | "enrollment_savings"
  | "presentation_status"
  | "sales_attribution"
  | "welcome_email";

function providerId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function finishRemoteActivation(input: {
  packet: EnrollmentPacketRow;
  membershipId: string;
  paymentCompletedAt: string;
  portalUrl: string | null;
}): Promise<RepairStep[]> {
  const supabase = createServiceRoleSupabaseClient();
  const membership = await loadMembershipForPayment(supabase, {
    membershipId: input.membershipId,
  });
  if (!membership) throw new Error("Activated enrollment membership was not found.");
  const repair: RepairStep[] = [];

  try {
    await ensureMembershipObligations(supabase, {
      membershipId: membership.id,
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      visitsPerYear: membership.visits_per_year,
      startedAt: membership.started_at ?? input.paymentCompletedAt,
    });
  } catch (error) {
    repair.push("obligations");
    console.error("[enrollment] obligations repair required", error);
  }
  try {
    await recordWebsiteMembershipSale(supabase, {
      membershipId: membership.id,
      paymentSetupCompletedAt: input.paymentCompletedAt,
      soldAt: input.paymentCompletedAt,
      activationMode: "stripe",
    });
  } catch (error) {
    repair.push("website_sale");
    console.error("[enrollment] website sale repair required", error);
  }
  try {
    await persistMembershipEnrollmentSavings(
      supabase,
      membership.id,
      membership.presentation_id,
    );
  } catch (error) {
    repair.push("enrollment_savings");
    console.error("[enrollment] savings repair required", error);
  }
  try {
    await syncMembershipSalesAttributionLifecycle({
      supabase,
      membershipId: membership.id,
    });
  } catch (error) {
    repair.push("sales_attribution");
    console.error("[enrollment] attribution repair required", error);
  }
  if (membership.presentation_id) {
    const presentation = await supabase
      .from("presentations")
      .update({ onboarding_status: "complete" })
      .eq("id", membership.presentation_id);
    if (presentation.error) repair.push("presentation_status");
  }
  const welcome = await sendMembershipWelcomeEmail(supabase, {
    membershipId: membership.id,
    homeownerId: membership.homeowner_id,
    presentationId: membership.presentation_id,
    portalUrl: input.portalUrl,
    idempotencyKey: buildInitialWelcomeIdempotencyKey(
      membership.id,
      input.paymentCompletedAt,
    ),
  });
  if (welcome.status !== "sent" && welcome.reason !== "already_sent") {
    repair.push("welcome_email");
  }
  return [...new Set(repair)];
}

export async function reconcileEnrollmentSetupIntent(
  intent: Stripe.SetupIntent,
): Promise<"processed" | "ignored"> {
  const metadata = intent.metadata ?? {};
  if (
    metadata.homeatlas_operation !== "membership_enrollment_setup" ||
    intent.status !== "succeeded"
  ) {
    return "ignored";
  }
  const packetId = metadata.homeatlas_enrollment_packet_id?.trim();
  const membershipId = metadata.membership_id?.trim();
  const presentationId = metadata.presentation_id?.trim();
  if (!packetId || !membershipId || !presentationId) {
    throw new Error("Enrollment SetupIntent is missing its HomeAtlas binding.");
  }
  const paymentMethodId = providerId(
    intent.payment_method as string | { id: string } | null,
  );
  const customerId = providerId(intent.customer as string | { id: string } | null);
  if (!paymentMethodId || !customerId) {
    throw new Error("Enrollment SetupIntent is missing its customer or payment method.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const packetResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("id", packetId)
    .maybeSingle();
  if (packetResult.error) throw new Error(packetResult.error.message);
  if (!packetResult.data) throw new Error("Enrollment packet not found.");
  const packet = packetResult.data as EnrollmentPacketRow;
  if (
    packet.membership_id !== membershipId ||
    packet.presentation_id !== presentationId
  ) {
    throw new Error("Enrollment SetupIntent binding does not match the packet.");
  }
  if (packet.status === "portal_ready" && packet.stripe_setup_intent_id === intent.id) {
    return "processed";
  }
  if (!packet.stripe_checkout_session_id) {
    throw new Error("Enrollment packet has no Stripe Checkout session binding.");
  }

  const membership = await loadMembershipForPayment(supabase, { membershipId });
  if (!membership || membership.presentation_id !== presentationId) {
    throw new Error("Enrollment membership binding does not match Stripe.");
  }
  if (membership.stripe_customer_id && membership.stripe_customer_id !== customerId) {
    throw new Error("Enrollment Stripe customer does not match the membership.");
  }
  const stripe = getStripe();
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const now = new Date().toISOString();
  const activation = await supabase
    .from("memberships")
    .update({
      status: "active",
      payment_setup_completed_at: membership.payment_setup_completed_at ?? now,
      started_at: membership.started_at ?? now,
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
    })
    .eq("id", membershipId);
  if (activation.error) throw new Error(activation.error.message);
  const paymentCompletedAt = membership.payment_setup_completed_at ?? now;
  const portalUrl = await getPortalAccessUrlForMembership(membershipId);

  const paymentEvent = await supabase
    .from("enrollment_packets")
    .update({
      status: "payment_complete",
      stripe_setup_intent_id: intent.id,
      stripe_payment_method_id: paymentMethodId,
      payment_completed_at: paymentCompletedAt,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", packetId);
  if (paymentEvent.error) throw new Error(paymentEvent.error.message);

  const repairNeeded = await finishRemoteActivation({
    packet,
    membershipId,
    paymentCompletedAt,
    portalUrl,
  });
  const readyAt = new Date().toISOString();
  const portalReady = await supabase
    .from("enrollment_packets")
    .update({
      status: "portal_ready",
      portal_ready_at: readyAt,
      last_error_code:
        repairNeeded.length > 0 ? "activation_repairs_required" : null,
      last_error_message:
        repairNeeded.length > 0
          ? `Non-blocking activation repairs: ${repairNeeded.join(", ")}`
          : null,
    })
    .eq("id", packetId);
  if (portalReady.error) throw new Error(portalReady.error.message);
  const audit = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: packetId,
    event_type: "portal_ready",
    actor: "stripe_verified_setup",
    provider: "stripe",
    provider_event_key: `setup-intent:${intent.id}:succeeded`,
    event_data: {
      setupIntentId: intent.id,
      membershipId,
      paymentCompletedAt,
      repairNeeded,
    },
  });
  if (audit.error && audit.error.code !== "23505") {
    throw new Error(audit.error.message);
  }
  return "processed";
}
