/** Client-side Stripe detection (publishable key is public) */
export function isStripeClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

/** Back-compat alias used by existing components */
export const STRIPE_CHECKOUT_ENABLED = isStripeClientEnabled();
