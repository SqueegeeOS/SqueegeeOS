import type { EnrollmentDocumentSnapshot } from "./types";
import { enrollmentScopePlainText } from "./document-snapshot";

export const DOCUSIGN_ENROLLMENT_TAB_LABELS = {
  legalCompanyName: "legal_company_name",
  legalBusinessAddress: "legal_business_address",
  legalNoticeEmail: "legal_notice_email",
  legalPhone: "legal_phone",
  customerName: "customer_name",
  customerEmail: "customer_email",
  customerPhone: "customer_phone",
  propertyAddress: "property_address",
  planName: "plan_name",
  cadence: "service_cadence",
  visitCount: "visits_per_year",
  firstVisitRate: "first_visit_rate",
  recurringVisitRate: "recurring_visit_rate",
  annualizedValue: "annualized_value",
  serviceScope: "service_scope",
  billingSummary: "billing_summary",
  billingConsent: "billing_consent",
  cancellationSummary: "cancellation_summary",
  rateChangeSummary: "rate_change_summary",
  renewalSummary: "renewal_summary",
  homeSolicitationNotice: "home_solicitation_notice",
} as const;

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function buildDocuSignEnrollmentTabs(input: {
  snapshot: EnrollmentDocumentSnapshot;
  legalCompanyName: string;
  legalBusinessAddress: string;
  legalNoticeEmail: string;
  legalPhone: string;
}): Array<{ tabLabel: string; value: string; locked: "true" }> {
  const noticeDays = input.snapshot.disclosures.homeSolicitationNoticeDays;
  const homeSolicitationNotice = noticeDays
    ? `California customer-home sale: use the owner-released ${noticeDays}-business-day cancellation notice and required Notice of Cancellation pages sourced from the current statute.`
    : "Not designated as a customer-home solicitation in HomeAtlas.";
  const values: Record<string, string> = {
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.legalCompanyName]: input.legalCompanyName,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.legalBusinessAddress]:
      input.legalBusinessAddress,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.legalNoticeEmail]: input.legalNoticeEmail,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.legalPhone]: input.legalPhone,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.customerName]: input.snapshot.customer.name,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.customerEmail]: input.snapshot.customer.email,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.customerPhone]:
      input.snapshot.customer.phone ?? "Not provided",
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.propertyAddress]:
      input.snapshot.property.fullAddress,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.planName]: input.snapshot.plan.tierLabel,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.cadence]: input.snapshot.plan.cadence,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.visitCount]: String(
      input.snapshot.plan.visitsPerYear,
    ),
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.firstVisitRate]: money(
      input.snapshot.plan.firstVisitPriceCents,
    ),
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.recurringVisitRate]: money(
      input.snapshot.plan.recurringVisitPriceCents,
    ),
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.annualizedValue]: money(
      input.snapshot.plan.annualizedValueCents,
    ),
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.serviceScope]:
      enrollmentScopePlainText(input.snapshot),
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.billingSummary]:
      input.snapshot.disclosures.billingSummary,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.billingConsent]:
      input.snapshot.disclosures.billingConsent,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.cancellationSummary]:
      input.snapshot.disclosures.cancellationSummary,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.rateChangeSummary]:
      input.snapshot.disclosures.rateChangeSummary,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.renewalSummary]:
      input.snapshot.disclosures.renewalSummary,
    [DOCUSIGN_ENROLLMENT_TAB_LABELS.homeSolicitationNotice]:
      homeSolicitationNotice,
  };

  return Object.entries(values).map(([tabLabel, value]) => ({
    tabLabel,
    value: value.slice(0, 4000),
    locked: "true" as const,
  }));
}
