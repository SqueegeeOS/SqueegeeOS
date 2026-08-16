import { describe, expect, it } from "vitest";
import { resolvePaymentSetupEmailState } from "./payment-setup-email-state";

const readyInput = {
  membershipStatus: "pending_payment",
  paymentSetupCompletedAt: null,
  stripePaymentMethodId: null,
  customerEmail: "member@example.com",
  presentationStatus: "signed",
  agreementStatus: "complete",
  billingAuthorizationVersion: "2026-08-01",
  billingAuthorizedAt: "2026-08-16T12:00:00.000Z",
  billingTermsHash: "a".repeat(64),
};

describe("resolvePaymentSetupEmailState", () => {
  it("enables the email handoff only for a fully signed member missing a card", () => {
    expect(resolvePaymentSetupEmailState(readyInput)).toBe("ready");
  });

  it("stops offering the handoff once Stripe setup is complete", () => {
    expect(
      resolvePaymentSetupEmailState({
        ...readyInput,
        paymentSetupCompletedAt: "2026-08-16T12:05:00.000Z",
      }),
    ).toBe("card_on_file");
  });

  it("identifies the prerequisites the owner must repair", () => {
    expect(
      resolvePaymentSetupEmailState({
        ...readyInput,
        customerEmail: "not-an-email",
      }),
    ).toBe("needs_email");

    expect(
      resolvePaymentSetupEmailState({
        ...readyInput,
        presentationStatus: "draft",
        agreementStatus: null,
      }),
    ).toBe("needs_agreement");

    expect(
      resolvePaymentSetupEmailState({
        ...readyInput,
        billingTermsHash: null,
      }),
    ).toBe("needs_authorization_review");
  });

  it("does not enable enrollment email for paused or active inconsistencies", () => {
    expect(
      resolvePaymentSetupEmailState({
        ...readyInput,
        membershipStatus: "paused",
      }),
    ).toBe("not_available");
  });
});
