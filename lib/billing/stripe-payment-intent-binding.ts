import type Stripe from "stripe";

export interface BillingPaymentIntentBinding {
  billingOrderId: string;
  membershipId: string;
  propertyId: string;
  appointmentId: string;
  serviceMonth: string;
  expectedChargeCents: number;
  stripeCustomerId: string;
  stripePaymentIntentId: string | null;
  livemode: boolean;
}

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function stripePaymentIntentReference(
  intent: Stripe.PaymentIntent,
): string {
  return stripeId(intent.latest_charge) ?? intent.id;
}

export function billingPaymentIntentBindingIssues(
  intent: Stripe.PaymentIntent,
  expected: BillingPaymentIntentBinding,
): string[] {
  const issues: string[] = [];
  if (
    expected.stripePaymentIntentId &&
    intent.id !== expected.stripePaymentIntentId
  ) {
    issues.push("payment_intent_id_mismatch");
  }
  if (intent.livemode !== expected.livemode) {
    issues.push("payment_intent_mode_mismatch");
  }
  if (intent.currency.toLowerCase() !== "usd") {
    issues.push("payment_intent_currency_mismatch");
  }
  if (intent.amount !== expected.expectedChargeCents) {
    issues.push("payment_intent_amount_mismatch");
  }
  if (
    intent.status === "succeeded" &&
    intent.amount_received !== expected.expectedChargeCents
  ) {
    issues.push("payment_intent_received_amount_mismatch");
  }
  if (stripeId(intent.customer) !== expected.stripeCustomerId) {
    issues.push("payment_intent_customer_mismatch");
  }
  const metadata = intent.metadata;
  if (metadata.homeatlas_billing_order_id !== expected.billingOrderId) {
    issues.push("payment_intent_order_metadata_mismatch");
  }
  if (metadata.membership_id !== expected.membershipId) {
    issues.push("payment_intent_membership_metadata_mismatch");
  }
  if (metadata.property_id !== expected.propertyId) {
    issues.push("payment_intent_property_metadata_mismatch");
  }
  if (metadata.appointment_id !== expected.appointmentId) {
    issues.push("payment_intent_appointment_metadata_mismatch");
  }
  if (metadata.service_month !== expected.serviceMonth) {
    issues.push("payment_intent_service_month_metadata_mismatch");
  }
  return issues;
}
