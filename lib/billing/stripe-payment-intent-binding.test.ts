import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  billingPaymentIntentBindingIssues,
  stripePaymentIntentReference,
  type BillingPaymentIntentBinding,
} from "./stripe-payment-intent-binding";

const expected: BillingPaymentIntentBinding = {
  billingOrderId: "order-123",
  membershipId: "membership-123",
  propertyId: "property-123",
  appointmentId: "appointment-123",
  serviceMonth: "2026-08-01",
  expectedChargeCents: 25000,
  stripeCustomerId: "cus_123",
  stripePaymentIntentId: "pi_123",
  livemode: true,
};

function paymentIntent(
  overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
  return {
    id: "pi_123",
    object: "payment_intent",
    amount: 25000,
    amount_received: 25000,
    currency: "usd",
    customer: "cus_123",
    latest_charge: "ch_123",
    livemode: true,
    metadata: {
      homeatlas_billing_order_id: "order-123",
      membership_id: "membership-123",
      property_id: "property-123",
      appointment_id: "appointment-123",
      service_month: "2026-08-01",
    },
    status: "succeeded",
    ...overrides,
  } as Stripe.PaymentIntent;
}

describe("Stripe PaymentIntent billing binding", () => {
  it("accepts only the exact live USD customer, amount, and metadata binding", () => {
    expect(
      billingPaymentIntentBindingIssues(paymentIntent(), expected),
    ).toEqual([]);
  });

  it("reports every material mismatch instead of trusting metadata alone", () => {
    const intent = paymentIntent({
      id: "pi_wrong",
      amount: 24900,
      amount_received: 24800,
      currency: "cad",
      customer: "cus_wrong",
      livemode: false,
      metadata: {
        homeatlas_billing_order_id: "wrong-order",
        membership_id: "wrong-membership",
        property_id: "wrong-property",
        appointment_id: "wrong-appointment",
        service_month: "2026-09-01",
      },
    });

    expect(billingPaymentIntentBindingIssues(intent, expected)).toEqual([
      "payment_intent_id_mismatch",
      "payment_intent_mode_mismatch",
      "payment_intent_currency_mismatch",
      "payment_intent_amount_mismatch",
      "payment_intent_received_amount_mismatch",
      "payment_intent_customer_mismatch",
      "payment_intent_order_metadata_mismatch",
      "payment_intent_membership_metadata_mismatch",
      "payment_intent_property_metadata_mismatch",
      "payment_intent_appointment_metadata_mismatch",
      "payment_intent_service_month_metadata_mismatch",
    ]);
  });

  it("uses an expanded Charge id as the local Stripe reference", () => {
    expect(
      stripePaymentIntentReference(
        paymentIntent({ latest_charge: { id: "ch_expanded" } as Stripe.Charge }),
      ),
    ).toBe("ch_expanded");
  });
});
