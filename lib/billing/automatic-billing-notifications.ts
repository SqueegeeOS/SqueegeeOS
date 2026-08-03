import "server-only";

import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { calculateQuietHoursDeliveryAt } from "@/lib/communications/automation";
import { ensureHomeownerConversation } from "@/lib/communications/repository";
import {
  scheduleOutboundCommunication,
  sendOutboundCommunication,
} from "@/lib/communications/service";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";

export type AutomaticBillingNotificationOutcome = "paid" | "needs_action";

export interface AutomaticBillingNotificationInput {
  billingOrderId: string;
  membershipId: string;
  homeownerId: string;
  homeownerFirstName: string | null;
  scheduledServiceAt: string;
  amountCents: number;
  outcome: AutomaticBillingNotificationOutcome;
  attemptNumber: number;
}

export interface AutomaticBillingNotificationContent {
  subject: string;
  body: string;
  idempotencyKey: string;
  smsBody: string | null;
  smsIdempotencyKey: string | null;
}

export function automaticBillingSmsDeliveryAt(
  requestedAt: string | Date,
): string | null {
  return calculateQuietHoursDeliveryAt(requestedAt);
}

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

function formatServiceDate(scheduledServiceAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(scheduledServiceAt));
}

export function buildAutomaticBillingNotificationContent(input: {
  billingOrderId: string;
  homeownerFirstName: string | null;
  scheduledServiceAt: string;
  amountCents: number;
  outcome: AutomaticBillingNotificationOutcome;
  attemptNumber: number;
  portalUrl: string | null;
}): AutomaticBillingNotificationContent {
  const amount = formatCurrency(input.amountCents);
  const firstName = input.homeownerFirstName?.trim() || "there";
  const serviceDate = formatServiceDate(input.scheduledServiceAt);
  if (input.outcome === "paid") {
    return {
      subject: "SqueegeeKing membership payment received",
      body: `Hi ${firstName}, your ${amount} SqueegeeKing membership payment for the visit scheduled ${serviceDate} was received. No payment will be due at the door.`,
      // A billing order can be paid only once. Excluding the attempt number
      // deduplicates executor and webhook races as well as distinct Stripe
      // Event objects that report the same successful PaymentIntent.
      idempotencyKey: `billing:${input.billingOrderId}:paid:email:v1`,
      smsBody: null,
      smsIdempotencyKey: null,
    };
  }

  return {
    subject: "Action needed: membership payment needs attention",
    body: `Hi ${firstName}, we could not process the ${amount} membership payment for your visit scheduled ${serviceDate}. Please review or update your saved card${input.portalUrl ? ` in your member portal: ${input.portalUrl}` : ""}, or contact SqueegeeKing because your bank may require approval. Your card will not be retried automatically until the payment issue is resolved.`,
    // A later, founder-authorized retry is a distinct customer-visible event.
    idempotencyKey: `billing:${input.billingOrderId}:needs_action:attempt:${input.attemptNumber}:email:v1`,
    smsBody: `SqueegeeKing: We could not process the ${amount} membership payment for your ${serviceDate} visit. Review your saved card${input.portalUrl ? `: ${input.portalUrl}` : ""} or contact us; bank approval may be required. No automatic retry until resolved. Reply STOP to opt out.`,
    smsIdempotencyKey: `billing:${input.billingOrderId}:needs_action:attempt:${input.attemptNumber}:sms:v1`,
  };
}

/**
 * Best-effort customer notification shared by the synchronous executor and
 * Stripe webhook reconciliation. Delivery failure must never roll back or
 * mislabel a real payment; the communications ledger records the send result.
 */
export async function notifyAutomaticBillingResult(
  input: AutomaticBillingNotificationInput,
): Promise<void> {
  let portalUrl: string | null = null;
  try {
    if (input.outcome === "needs_action") {
      portalUrl = await getPortalAccessUrlForMembership(
        input.membershipId,
        PUBLIC_SITE_URL,
      );
    }
  } catch (error) {
    console.warn("[automatic-billing] portal link unavailable", {
      billingOrderId: input.billingOrderId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
  const content = buildAutomaticBillingNotificationContent({
    billingOrderId: input.billingOrderId,
    homeownerFirstName: input.homeownerFirstName,
    scheduledServiceAt: input.scheduledServiceAt,
    amountCents: input.amountCents,
    outcome: input.outcome,
    attemptNumber: input.attemptNumber,
    portalUrl,
  });
  let conversationId: string;
  try {
    conversationId = (
      await ensureHomeownerConversation({
        homeownerId: input.homeownerId,
        subject: "Membership billing updates",
      })
    ).id;
  } catch (error) {
    console.warn("[automatic-billing] customer notification skipped", {
      billingOrderId: input.billingOrderId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return;
  }

  try {
    await sendOutboundCommunication({
      conversationId,
      channel: "email",
      subject: content.subject,
      body: content.body,
      idempotencyKey: content.idempotencyKey,
      metadata: {
        source: "automatic_membership_billing",
        billingOrderId: input.billingOrderId,
        outcome: input.outcome,
        attemptNumber: input.attemptNumber,
      },
    });
  } catch (error) {
    console.warn("[automatic-billing] customer email skipped", {
      billingOrderId: input.billingOrderId,
      outcome: input.outcome,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  // A payment problem is time-sensitive, so also attempt SMS. The shared
  // communications gate sends only when Twilio is configured and the exact
  // destination is verified and explicitly opted in. Paid receipts remain
  // email-only to avoid unnecessary duplicate notifications.
  if (content.smsBody && content.smsIdempotencyKey) {
    try {
      const requestedAt = new Date();
      const notBefore = automaticBillingSmsDeliveryAt(requestedAt);
      if (!notBefore) throw new Error("billing_sms_quiet_hours_unavailable");
      const message = {
        conversationId,
        channel: "sms" as const,
        body: content.smsBody,
        idempotencyKey: content.smsIdempotencyKey,
        metadata: {
          source: "automatic_membership_billing",
          billingOrderId: input.billingOrderId,
          outcome: input.outcome,
          attemptNumber: input.attemptNumber,
        },
      };
      if (new Date(notBefore).getTime() > requestedAt.getTime()) {
        await scheduleOutboundCommunication({
          ...message,
          scheduledFor: notBefore,
        });
      } else {
        await sendOutboundCommunication(message);
      }
    } catch (error) {
      console.warn("[automatic-billing] customer SMS skipped", {
        billingOrderId: input.billingOrderId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
