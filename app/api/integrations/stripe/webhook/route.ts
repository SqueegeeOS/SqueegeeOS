import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { processStripeBillingWebhook } from "@/lib/billing/stripe-billing-webhook";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe webhook signature" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    );
  } catch (error) {
    console.warn("[stripe-webhook] signature rejected", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await processStripeBillingWebhook({ event, rawBody });
    return NextResponse.json(
      { received: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[stripe-webhook] processing failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Stripe webhook processing failed and will be retried" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
