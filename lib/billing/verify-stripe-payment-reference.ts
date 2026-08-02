import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

export interface VerifiedStripePaymentReference {
  reference: string;
  paymentIntentId: string | null;
  verifiedAt: string;
}

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function assertCommonPaymentTruth(input: {
  livemode: boolean;
  currency: string;
  customerId: string | null;
  amountCents: number;
  expectedCustomerId: string;
  expectedAmountCents: number;
}) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("Stripe is not configured on the server.");
  const expectedLivemode = secret.startsWith("sk_live_");
  if (input.livemode !== expectedLivemode) {
    throw new Error("Stripe payment mode does not match this deployment.");
  }
  if (input.currency.toLowerCase() !== "usd") {
    throw new Error("Only USD Stripe payments can be recorded.");
  }
  if (input.customerId !== input.expectedCustomerId) {
    throw new Error("Stripe payment belongs to another customer.");
  }
  if (input.amountCents !== input.expectedAmountCents) {
    throw new Error("Stripe payment amount does not match the ledger amount.");
  }
}

function assertMetadata(
  metadata: Stripe.Metadata | null,
  requiredMetadata: Record<string, string> | undefined,
) {
  for (const [key, expected] of Object.entries(requiredMetadata ?? {})) {
    if (metadata?.[key] !== expected) {
      throw new Error(`Stripe payment metadata mismatch: ${key}.`);
    }
  }
}

export async function verifyStripePaymentReference(input: {
  reference: string;
  expectedCustomerId: string;
  expectedAmountCents: number;
  requiredMetadata?: Record<string, string>;
}): Promise<VerifiedStripePaymentReference> {
  const stripe = getStripe();
  const reference = input.reference.trim();
  const verifiedAt = new Date().toISOString();

  if (reference.startsWith("pi_")) {
    const intent = await stripe.paymentIntents.retrieve(reference);
    if (intent.status !== "succeeded") {
      throw new Error("Stripe PaymentIntent is not succeeded.");
    }
    assertCommonPaymentTruth({
      livemode: intent.livemode,
      currency: intent.currency,
      customerId: objectId(intent.customer),
      amountCents: intent.amount_received,
      expectedCustomerId: input.expectedCustomerId,
      expectedAmountCents: input.expectedAmountCents,
    });
    assertMetadata(intent.metadata, input.requiredMetadata);
    return { reference, paymentIntentId: intent.id, verifiedAt };
  }

  if (reference.startsWith("ch_")) {
    const charge = await stripe.charges.retrieve(reference);
    if (!charge.paid || !charge.captured || charge.amount_refunded !== 0) {
      throw new Error("Stripe charge is not fully captured and unrefunded.");
    }
    assertCommonPaymentTruth({
      livemode: charge.livemode,
      currency: charge.currency,
      customerId: objectId(charge.customer),
      amountCents: charge.amount_captured,
      expectedCustomerId: input.expectedCustomerId,
      expectedAmountCents: input.expectedAmountCents,
    });
    assertMetadata(charge.metadata, input.requiredMetadata);
    return {
      reference,
      paymentIntentId: objectId(charge.payment_intent),
      verifiedAt,
    };
  }

  if (reference.startsWith("in_")) {
    const invoice = await stripe.invoices.retrieve(reference);
    if (invoice.status !== "paid" || invoice.amount_remaining !== 0) {
      throw new Error("Stripe invoice is not fully paid.");
    }
    assertCommonPaymentTruth({
      livemode: invoice.livemode,
      currency: invoice.currency,
      customerId: objectId(invoice.customer),
      amountCents: invoice.amount_paid,
      expectedCustomerId: input.expectedCustomerId,
      expectedAmountCents: input.expectedAmountCents,
    });
    assertMetadata(invoice.metadata, input.requiredMetadata);
    const payments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      status: "paid",
      limit: 1,
    });
    return {
      reference,
      paymentIntentId: objectId(payments.data[0]?.payment.payment_intent),
      verifiedAt,
    };
  }

  throw new Error("Unsupported Stripe payment reference.");
}
