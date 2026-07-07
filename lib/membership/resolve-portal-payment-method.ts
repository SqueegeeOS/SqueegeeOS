import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

function formatCardBrand(brand: string): string {
  const normalized = brand.trim().toLowerCase();
  if (normalized === "amex") return "Amex";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Server-only — resolves member-facing card label (e.g. "Visa ···· 4242").
 * Degrades to null when Stripe is unavailable; caller shows "Card on file ✓".
 */
export async function resolvePortalPaymentMethodLabel(
  stripePaymentMethodId: string | null | undefined,
): Promise<string | null> {
  const id = stripePaymentMethodId?.trim();
  if (!id || !isStripeServerEnabled()) {
    return null;
  }

  try {
    const stripe = getStripe();
    const method = await stripe.paymentMethods.retrieve(id);
    if (method.type !== "card" || !method.card?.last4) {
      return null;
    }
    const brand = method.card.brand
      ? formatCardBrand(method.card.brand)
      : "Card";
    return `${brand} ···· ${method.card.last4}`;
  } catch {
    return null;
  }
}
