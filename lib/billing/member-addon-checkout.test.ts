import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { memberAddonPaymentIntentBindingIssues } from "./member-addon-checkout";

function intent(
  patch: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
  return {
    id: "pi_addon",
    object: "payment_intent",
    amount: 10_000,
    currency: "usd",
    customer: "cus_member",
    livemode: true,
    metadata: {
      homeatlas_operation: "member_addon_checkout",
      homeatlas_addon_id: "addon_123",
      membership_id: "membership_123",
      property_id: "property_123",
    },
    ...patch,
  } as Stripe.PaymentIntent;
}

const addon = { id: "addon_123", amount_charged_cents: 10_000 };
const membership = {
  id: "membership_123",
  property_id: "property_123",
  stripe_customer_id: "cus_member",
};

describe("member add-on Stripe Checkout binding", () => {
  it("accepts only the exact member, property, add-on, amount, currency, customer, and mode", () => {
    expect(
      memberAddonPaymentIntentBindingIssues({
        intent: intent(),
        addon,
        membership,
        stripeLiveMode: true,
      }),
    ).toEqual([]);
  });

  it("fails closed when Stripe payment evidence does not match the add-on", () => {
    expect(
      memberAddonPaymentIntentBindingIssues({
        intent: intent({
          amount: 9_999,
          currency: "cad",
          customer: "cus_other",
          livemode: false,
          metadata: {
            homeatlas_operation: "other",
            homeatlas_addon_id: "addon_other",
            membership_id: "membership_other",
            property_id: "property_other",
          },
        }),
        addon,
        membership,
        stripeLiveMode: true,
      }),
    ).toEqual([
      "operation_mismatch",
      "addon_mismatch",
      "membership_mismatch",
      "property_mismatch",
      "currency_mismatch",
      "stripe_mode_mismatch",
      "stripe_customer_mismatch",
      "amount_mismatch",
    ]);
  });
});
