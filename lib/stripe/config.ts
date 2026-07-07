import { isStripeClientEnabled } from "./client";

export function isStripeServerEnabled(): boolean {
  return (
    isStripeClientEnabled() && Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  );
}
