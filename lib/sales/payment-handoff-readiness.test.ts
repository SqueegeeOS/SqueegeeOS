import { describe, expect, it } from "vitest";
import { resolveSalesPaymentSetupEmailState } from "./payment-handoff-readiness";

const membership = {
  id: "membership-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  presentation_id: "presentation-1",
  agreement_id: "agreement-1",
  status: "pending_payment",
  payment_setup_completed_at: null,
  stripe_payment_method_id: null,
  stripe_customer_id: "cus_123",
  sales_tier: "quarterly",
  visit_price: 300,
  visits_per_year: 4,
};

const homeowner = {
  id: "homeowner-1",
  full_name: "Mandi Rivera",
  email: "mandi@example.com",
};

const property = { id: "property-1" };

const presentation = {
  id: "presentation-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  membership_id: "membership-1",
  client_email: "mandi@example.com",
  status: "signed",
};

const agreement = {
  id: "agreement-1",
  membership_id: "membership-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  status: "complete",
  billing_authorization_version: "standing-authorization-v1",
  billing_authorized_at: "2026-08-16T17:00:00.000Z",
  billing_terms_hash: "a".repeat(64),
};

function state(
  overrides: Partial<Parameters<typeof resolveSalesPaymentSetupEmailState>[0]> = {},
) {
  return resolveSalesPaymentSetupEmailState({
    signedAgreementId: "agreement-1",
    membership,
    homeowner,
    property,
    presentation,
    agreement,
    ...overrides,
  });
}

describe("signed-close payment email readiness", () => {
  it("enables the email only when the exact signed lineage and authorization resolve", () => {
    expect(state()).toBe("ready");
  });

  it("fails closed when the attribution points to a different agreement", () => {
    expect(state({ signedAgreementId: "agreement-other" })).toBe(
      "needs_authorization_review",
    );
  });

  it("fails closed when the presentation is bound to another membership", () => {
    expect(
      state({
        presentation: { ...presentation, membership_id: "membership-other" },
      }),
    ).toBe("needs_authorization_review");
  });

  it("fails closed when the referenced homeowner or property cannot be proven", () => {
    expect(state({ homeowner: undefined })).toBe("needs_authorization_review");
    expect(state({ property: undefined })).toBe("needs_authorization_review");
  });

  it("requires a customer email and complete source records", () => {
    expect(
      state({
        homeowner: { ...homeowner, email: null },
        presentation: { ...presentation, client_email: null },
      }),
    ).toBe("needs_email");
    expect(state({ agreement: undefined })).toBe("needs_agreement");
  });
});
