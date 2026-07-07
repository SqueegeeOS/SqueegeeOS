import { getStripePublishableKey } from "./client";

export type StripeKeyMode = "live" | "test" | "missing" | "mismatch";

function keyMode(
  key: string | null | undefined,
): "live" | "test" | "unknown" | "missing" {
  const trimmed = key?.trim();
  if (!trimmed) return "missing";
  if (trimmed.startsWith("sk_live_") || trimmed.startsWith("pk_live_")) {
    return "live";
  }
  if (trimmed.startsWith("sk_test_") || trimmed.startsWith("pk_test_")) {
    return "test";
  }
  return "unknown";
}

/** Whether publishable + secret keys are both present and both live-mode. */
export function resolveStripeKeyMode(
  secretKey = process.env.STRIPE_SECRET_KEY,
  publishableKey = getStripePublishableKey(),
): StripeKeyMode {
  const secret = keyMode(secretKey);
  const publishable = keyMode(publishableKey);

  if (secret === "missing" || publishable === "missing") {
    return "missing";
  }

  if (secret === "live" && publishable === "live") {
    return "live";
  }

  if (secret === "test" && publishable === "test") {
    return "test";
  }

  return "mismatch";
}

export function isStripeLiveMode(
  secretKey = process.env.STRIPE_SECRET_KEY,
  publishableKey = getStripePublishableKey(),
): boolean {
  return resolveStripeKeyMode(secretKey, publishableKey) === "live";
}
