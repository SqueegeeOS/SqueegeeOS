import type {
  MembershipCheckoutPayload,
  StripeCheckoutSession,
} from "./types";
import { STRIPE_CHECKOUT_ENABLED } from "./types";

/**
 * Creates a Stripe Checkout session for membership enrollment.
 *
 * When STRIPE_CHECKOUT_ENABLED is true, this will call:
 *   POST /api/stripe/checkout
 * which creates a Stripe Checkout Session with:
 *   - mode: 'subscription' | 'payment' (based on plan)
 *   - customer email from homeowner
 *   - metadata: propertySlug, planId, signature
 *   - success_url / cancel_url back to Home Care Plan / Member Portal
 *
 * For now: returns mock session — no redirect, no payment collected.
 */
export async function createMembershipCheckoutSession(
  payload: MembershipCheckoutPayload,
): Promise<StripeCheckoutSession> {
  if (STRIPE_CHECKOUT_ENABLED) {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to start secure checkout");
    }

    const data = (await response.json()) as {
      sessionId: string;
      url: string;
    };

    return {
      sessionId: data.sessionId,
      checkoutUrl: data.url,
      mode: "live",
    };
  }

  // Mock session — Stripe not connected
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    sessionId: `mock_cs_${payload.planId}_${Date.now()}`,
    checkoutUrl: null,
    mode: "mock",
  };
}

/**
 * Redirects the customer to Stripe Checkout.
 * In mock mode, resolves without navigation.
 */
export async function redirectToStripeCheckout(
  session: StripeCheckoutSession,
): Promise<void> {
  if (session.mode === "live" && session.checkoutUrl) {
    window.location.href = session.checkoutUrl;
    return;
  }

  // Mock: no redirect — caller shows placeholder completion UI
}
