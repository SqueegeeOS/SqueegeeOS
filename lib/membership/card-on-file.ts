import { STRIPE_CHECKOUT_ENABLED } from "./types";

export interface SaveCardOnFileInput {
  memberName: string;
  memberEmail?: string | null;
  presentationId?: string;
}

export interface SaveCardOnFileResult {
  saved: boolean;
  mode: "mock" | "live";
}

/**
 * Saves a payment method on file for membership billing.
 * Mock mode simulates success until Stripe Setup / Checkout is wired.
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

  await new Promise((resolve) => setTimeout(resolve, 900));
  void input;
  return { saved: true, mode: "mock" };
}
