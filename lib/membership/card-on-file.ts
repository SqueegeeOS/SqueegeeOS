import { isStripeClientEnabled } from "@/lib/stripe/client";

export interface SaveCardOnFileInput {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
  membershipId?: string;
}

export interface SaveCardOnFileResult {
  saved: boolean;
  mode: "mock" | "stripe";
  membershipId?: string;
  onboardingStatus?: string;
}

/**
 * Mock mode: activates membership without card data (Stripe disabled).
 * Stripe mode: handled by StripePaymentSetup + setup-payment API.
 */
export async function saveCardOnFile(
  input: SaveCardOnFileInput,
): Promise<SaveCardOnFileResult> {
  if (isStripeClientEnabled()) {
    throw new Error(
      "Use Stripe Elements to save a card when Stripe is enabled.",
    );
  }

  if (!input.presentationId && !input.membershipId) {
    throw new Error("Missing presentation or membership reference");
  }

  const response = await fetch("/api/membership/setup-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presentationId: input.presentationId,
      membershipId: input.membershipId,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    membershipId?: string;
    onboardingStatus?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Unable to save payment method");
  }

  return {
    saved: true,
    mode: "mock",
    membershipId: body?.membershipId,
    onboardingStatus: body?.onboardingStatus,
  };
}
