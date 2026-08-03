import { createHash } from "node:crypto";
import {
  MEMBERSHIP_BILLING_FINE_PRINT,
  membershipAgreementCheckboxText,
} from "@/lib/agreement/agreement-content";

export const MEMBERSHIP_BILLING_AUTHORIZATION_VERSION =
  "membership-first-service-month-v1";

export function membershipBillingTermsHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
        schedule: "first_of_service_month",
        disclosure: MEMBERSHIP_BILLING_FINE_PRINT,
        acceptance: membershipAgreementCheckboxText(),
      }),
    )
    .digest("hex");
}

export interface MembershipBillingAuthorizationInput {
  agreementId: string | null;
  agreementStatus: string | null;
  agreementMembershipId: string | null;
  agreementPropertyId: string | null;
  billingAuthorizationVersion: string | null;
  billingAuthorizedAt: string | null;
  billingTermsHash: string | null;
  authorizedVisitPriceCents: number | null;
  membershipId: string;
  propertyId: string;
  currentVisitPriceCents: number | null;
}

export function membershipBillingAuthorizationIssues(
  input: MembershipBillingAuthorizationInput,
): string[] {
  const issues: string[] = [];
  if (!input.agreementId) issues.push("signed_agreement_required");
  if (input.agreementStatus !== "complete") {
    issues.push("signed_agreement_not_complete");
  }
  if (
    input.agreementMembershipId !== input.membershipId ||
    input.agreementPropertyId !== input.propertyId
  ) {
    issues.push("signed_agreement_binding_mismatch");
  }
  if (
    input.billingAuthorizationVersion !==
      MEMBERSHIP_BILLING_AUTHORIZATION_VERSION ||
    !input.billingAuthorizedAt ||
    input.billingTermsHash !== membershipBillingTermsHash()
  ) {
    issues.push("automatic_billing_authorization_unverified");
  }
  if (
    !Number.isInteger(input.authorizedVisitPriceCents) ||
    !Number.isInteger(input.currentVisitPriceCents) ||
    input.authorizedVisitPriceCents! <= 0 ||
    input.authorizedVisitPriceCents !== input.currentVisitPriceCents
  ) {
    issues.push("signed_visit_price_mismatch");
  }
  return issues;
}

export function isMembershipBillingAuthorized(
  input: MembershipBillingAuthorizationInput,
): boolean {
  return membershipBillingAuthorizationIssues(input).length === 0;
}
