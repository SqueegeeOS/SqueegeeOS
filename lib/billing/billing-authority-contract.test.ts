import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const executor = readFileSync(
  new URL("./automatic-billing-executor.ts", import.meta.url),
  "utf8",
);
const manualCharge = readFileSync(
  new URL("../admin/record-manual-billing-charge.ts", import.meta.url),
  "utf8",
);
const completeCharge = readFileSync(
  new URL("../admin/complete-charge-visit.ts", import.meta.url),
  "utf8",
);
const stripeWebhook = readFileSync(
  new URL("./stripe-billing-webhook.ts", import.meta.url),
  "utf8",
);

describe("billing authority runtime contract", () => {
  it("never trusts a historical paid ledger without post-hardening evidence", () => {
    expect(executor).toContain("billing_authority_verified_at");
    expect(executor).toContain("billing_authority_verified_by?.trim()");
    expect(executor).toContain(
      "historical_paid_ledger_not_post_hardening_verified",
    );
    expect(executor).toContain("reconciliation_required");
  });

  it("independently verifies manual Stripe references before stamping authority", () => {
    expect(manualCharge).toContain("verifyStripePaymentReference");
    expect(manualCharge).toContain(
      'billing_authority_verified_by: "stripe_verified_manual_record"',
    );
  });

  it("binds Complete & Charge invoices before payment and authority stamping", () => {
    expect(completeCharge).toContain("assertInvoiceBinding");
    expect(completeCharge).toContain("verifyStripePaymentReference");
    expect(completeCharge).toContain(
      'billing_authority_verified_by: "stripe_verified_complete_charge"',
    );
  });

  it("quarantines unknown provider outcomes instead of creating another charge", () => {
    expect(executor).toContain("stripe_create_response_unknown");
    expect(executor).toContain(
      "processing_lease_expired_without_payment_intent_id",
    );
    expect(executor).toContain("unbound_historical_provider_reference");
    expect(executor).toContain("ledger_compare_and_set_lost");
  });

  it("validates retrieved PaymentIntents before confirmation", () => {
    const retrieveAt = executor.indexOf("stripe.paymentIntents.retrieve");
    const retrievedBindingAt = executor.indexOf(
      "const retrievedBindingIssues = paymentIntentBindingIssues",
      retrieveAt,
    );
    const confirmAt = executor.indexOf("stripe.paymentIntents.confirm", retrieveAt);
    expect(retrieveAt).toBeGreaterThan(-1);
    expect(retrievedBindingAt).toBeGreaterThan(retrieveAt);
    expect(confirmAt).toBeGreaterThan(retrievedBindingAt);
  });

  it("uses only live signed Stripe deliveries to verify the live webhook gate", () => {
    expect(stripeWebhook).toContain(
      "webhookSecret && event.livemode && isStripeLiveMode()",
    );
  });
});
