import { STRIPE_CHECKOUT_ENABLED } from "./types";

export interface SaveCardOnFileInput {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
  membershipId?: string;
}

export interface SaveCardOnFileResult {
  saved: boolean;
  mode: "mock" | "live";
  membershipId?: string;
  onboardingStatus?: string;
}

/**
 * Saves a payment method on file for membership billing.
 * Mock mode activates membership via setup-payment — no raw card data is sent or stored.
 */
export async function saveCardOnFile(
  input: SaveCardOnFileInput,
): Promise<SaveCardOnFileResult> {
  if (STRIPE_CHECKOUT_ENABLED) {
    const response = await fetch("/api/stripe/setup-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error("Unable to save payment method");
    }

    return { saved: true, mode: "live" };
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
