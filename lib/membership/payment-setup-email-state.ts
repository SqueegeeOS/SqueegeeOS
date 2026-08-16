import { normalizeEmailDestination } from "@/lib/communications/providers/contracts";

export type PaymentSetupEmailState =
  | "ready"
  | "card_on_file"
  | "needs_email"
  | "needs_agreement"
  | "needs_authorization_review"
  | "not_available";

export interface PaymentSetupEmailStateInput {
  membershipStatus: string;
  paymentSetupCompletedAt: string | null | undefined;
  stripePaymentMethodId: string | null | undefined;
  customerEmail: string | null | undefined;
  presentationStatus: string | null | undefined;
  agreementStatus: string | null | undefined;
  billingAuthorizationVersion: string | null | undefined;
  billingAuthorizedAt: string | null | undefined;
  billingTermsHash: string | null | undefined;
}

/**
 * Mirrors the prerequisites enforced by the hosted Stripe handoff service so
 * HQ only offers an enabled email action when the server can safely honor it.
 */
export function resolvePaymentSetupEmailState(
  input: PaymentSetupEmailStateInput,
): PaymentSetupEmailState {
  if (
    input.paymentSetupCompletedAt?.trim() ||
    input.stripePaymentMethodId?.trim()
  ) {
    return "card_on_file";
  }

  if (!normalizeEmailDestination(input.customerEmail)) {
    return "needs_email";
  }

  if (input.membershipStatus !== "pending_payment") {
    if (
      input.membershipStatus === "pending_checkout" ||
      input.membershipStatus === "inactive"
    ) {
      return "needs_agreement";
    }
    return "not_available";
  }

  if (
    input.presentationStatus !== "signed" ||
    input.agreementStatus !== "complete"
  ) {
    return "needs_agreement";
  }

  if (
    !input.billingAuthorizationVersion?.trim() ||
    !input.billingAuthorizedAt?.trim() ||
    !/^[0-9a-f]{64}$/.test(input.billingTermsHash?.trim() ?? "")
  ) {
    return "needs_authorization_review";
  }

  return "ready";
}
