import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import type { CarePlanServiceState } from "@/lib/presentations/care-plan";
import type { PaymentRail } from "@/lib/billing/payment-rail";

export type EnrollmentSalesContext =
  | "customer_home"
  | "business_premises"
  | "remote"
  | "other";

export type EnrollmentPacketStatus =
  | "draft"
  | "signature_sent"
  | "signature_complete"
  | "payment_ready"
  | "payment_sent"
  | "payment_complete"
  | "portal_ready"
  | "needs_attention"
  | "voided";

export interface EnrollmentPacketStatusSnapshot {
  status: EnrollmentPacketStatus;
  paymentRail: PaymentRail;
  updatedAt: string;
}

export interface EnrollmentVisitSnapshot {
  label: string;
  timing: string;
  priceCents: number;
  /** Added in schema v2. A missing legacy value means exterior was included. */
  exteriorWindows?: CarePlanServiceState;
  interiorWindows: CarePlanServiceState;
  screens: CarePlanServiceState;
  cobwebRemoval: CarePlanServiceState;
  /** Added in schema v2. Missing legacy values mean not included. */
  solarPanels?: CarePlanServiceState;
  pressureWashing?: CarePlanServiceState;
  notes: string;
}

export interface EnrollmentDocumentSnapshot {
  schemaVersion: 1 | 2;
  presentationId: string;
  customer: {
    name: string;
    email: string;
    phone: string | null;
  };
  /** Optional human signer when the agreement customer is a household. */
  signer?: {
    name: string;
    email: string;
    phone: string | null;
  };
  property: {
    fullAddress: string;
    squareFeet: number | null;
    twoStory: boolean;
  };
  plan: {
    tier: SqueegeeKingTierId;
    tierLabel: string;
    cadence: string;
    visitsPerYear: number;
    firstVisitPriceCents: number;
    recurringVisitPriceCents: number;
    annualizedValueCents: number;
    addonDiscountPercent: number;
    summary: string;
    customerChoiceNote: string;
    visits: EnrollmentVisitSnapshot[];
  };
  /** Added in schema v2. Legacy signed packets are treated as Stripe-card. */
  payment?: {
    rail: PaymentRail;
    arrangementSummary: string;
  };
  disclosures: {
    salesContext: EnrollmentSalesContext;
    homeSolicitationNoticeDays: 3 | 5 | null;
    renewalSummary: string;
    cancellationSummary: string;
    rateChangeSummary: string;
    billingSummary: string;
    billingConsent: string;
  };
  createdAt: string;
}

export interface ApprovedAgreementVersion {
  id: string;
  documentKind: "master_service_agreement" | "service_quote_agreement";
  version: string;
  contentSha256: string;
  approvedAt: string;
  approvedBy: string;
}

export interface EnrollmentPacketRow {
  id: string;
  presentation_id: string;
  customer_name: string;
  customer_email: string;
  agreement_tier: SqueegeeKingTierId;
  first_visit_price_cents: number;
  recurring_visit_price_cents: number;
  annualized_value_cents: number;
  sales_context: EnrollmentSalesContext;
  home_solicitation_notice_days: 3 | 5 | null;
  payment_rail: PaymentRail;
  manual_payment_approved_at: string | null;
  manual_payment_approved_by: string | null;
  document_snapshot: EnrollmentDocumentSnapshot;
  public_token_sha256: string;
  public_token_expires_at: string;
  status: EnrollmentPacketStatus;
  docusign_envelope_id: string | null;
  docusign_status: string | null;
  signature_sent_at: string | null;
  signed_at: string | null;
  signed_agreement_id: string | null;
  homeowner_id: string | null;
  property_id: string | null;
  membership_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_payment_url: string | null;
  stripe_payment_url_expires_at: string | null;
  stripe_checkout_attempt: number;
  payment_link_sent_at: string | null;
  payment_completed_at: string | null;
  portal_ready_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}
