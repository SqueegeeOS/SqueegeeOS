import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  resolvePaymentSetupEmailState,
  type PaymentSetupEmailState,
} from "@/lib/membership/payment-setup-email-state";
import type { SalesProductionHandoffMembership } from "./production-handoff";

export interface SalesHandoffHomeownerEvidence {
  id: string;
  full_name: string;
  email: string | null;
}

export interface SalesHandoffPropertyEvidence {
  id: string;
}

export interface SalesHandoffPresentationEvidence {
  id: string;
  homeowner_id: string;
  property_id: string;
  membership_id: string | null;
  client_email: string | null;
  status: string;
}

export interface SalesHandoffAgreementEvidence {
  id: string;
  membership_id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  billing_authorization_version: string | null;
  billing_authorized_at: string | null;
  billing_terms_hash: string | null;
}

/**
 * Mirrors the hosted Stripe email gate and adds exact signed-record lineage.
 * A caller may expose a send control only when this returns `ready`.
 */
export function resolveSalesPaymentSetupEmailState(input: {
  signedAgreementId: string;
  membership: SalesProductionHandoffMembership | null;
  homeowner: SalesHandoffHomeownerEvidence | undefined;
  property: SalesHandoffPropertyEvidence | undefined;
  presentation: SalesHandoffPresentationEvidence | undefined;
  agreement: SalesHandoffAgreementEvidence | undefined;
}): PaymentSetupEmailState {
  const { membership, homeowner, property, presentation, agreement } = input;
  if (!membership) return "not_available";
  if (!presentation || !agreement) return "needs_agreement";
  if (!homeowner || !property) return "needs_authorization_review";

  const bindingMatches =
    homeowner.id === membership.homeowner_id &&
    property.id === membership.property_id &&
    membership.presentation_id === presentation.id &&
    membership.agreement_id === agreement.id &&
    input.signedAgreementId === agreement.id &&
    presentation.homeowner_id === membership.homeowner_id &&
    presentation.property_id === membership.property_id &&
    presentation.membership_id === membership.id &&
    agreement.membership_id === membership.id &&
    agreement.homeowner_id === membership.homeowner_id &&
    agreement.property_id === membership.property_id;
  if (!bindingMatches) return "needs_authorization_review";

  return resolvePaymentSetupEmailState({
    membershipStatus: membership.status,
    paymentSetupCompletedAt: membership.payment_setup_completed_at,
    stripePaymentMethodId: membership.stripe_payment_method_id,
    customerEmail: resolveMemberEmail(presentation.client_email, homeowner.email),
    presentationStatus: presentation.status,
    agreementStatus: agreement.status,
    billingAuthorizationVersion: agreement.billing_authorization_version,
    billingAuthorizedAt: agreement.billing_authorized_at,
    billingTermsHash: agreement.billing_terms_hash,
  });
}
