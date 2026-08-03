import { describe, expect, it } from "vitest";
import {
  isMembershipBillingAuthorized,
  membershipBillingAuthorizationIssues,
  membershipBillingTermsHash,
  MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
} from "./membership-billing-authorization";

const authorized = {
  agreementId: "agreement-1",
  agreementStatus: "complete",
  agreementMembershipId: "membership-1",
  agreementPropertyId: "property-1",
  billingAuthorizationVersion: MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
  billingAuthorizedAt: "2026-08-02T12:00:00.000Z",
  billingTermsHash: membershipBillingTermsHash(),
  authorizedVisitPriceCents: 25_000,
  membershipId: "membership-1",
  propertyId: "property-1",
  currentVisitPriceCents: 25_000,
};

describe("membership billing authorization", () => {
  it("accepts only a complete, correctly bound current authorization", () => {
    expect(isMembershipBillingAuthorized(authorized)).toBe(true);
    expect(membershipBillingAuthorizationIssues(authorized)).toEqual([]);
  });

  it("fails closed for legacy agreements without the current terms evidence", () => {
    expect(
      membershipBillingAuthorizationIssues({
        ...authorized,
        billingAuthorizationVersion: null,
        billingAuthorizedAt: null,
        billingTermsHash: null,
        authorizedVisitPriceCents: null,
      }),
    ).toEqual([
      "automatic_billing_authorization_unverified",
      "signed_visit_price_mismatch",
    ]);
  });

  it("rejects an agreement from another home or a changed visit price", () => {
    expect(
      membershipBillingAuthorizationIssues({
        ...authorized,
        agreementPropertyId: "property-2",
        currentVisitPriceCents: 30_000,
      }),
    ).toEqual([
      "signed_agreement_binding_mismatch",
      "signed_visit_price_mismatch",
    ]);
  });

  it("changes the terms hash if the version or signed disclosure changes", () => {
    expect(membershipBillingTermsHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(MEMBERSHIP_BILLING_AUTHORIZATION_VERSION).toBe(
      "membership-jobber-scheduled-services-v2",
    );
  });
});
