import {
  MEMBERSHIP_BILLING_FINE_PRINT_BODY,
  membershipAgreementCheckboxText,
  membershipCancellationReimbursementClause,
} from "@/lib/agreement/agreement-content";
import { enrollmentSavingsForPresentation } from "@/lib/presentations/calculations";
import {
  calculateCarePlanPricing,
  createDefaultCarePlan,
  serviceStateLabel,
} from "@/lib/presentations/care-plan";
import type { PresentationData } from "@/lib/presentations/types";
import {
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import type {
  EnrollmentDocumentSnapshot,
  EnrollmentSalesContext,
} from "./types";

export const ENROLLMENT_RENEWAL_SUMMARY =
  "The plan continues at its stated cadence after the initial term unless the customer cancels through the retainable cancellation method in this Service & Quote Agreement.";

export const ENROLLMENT_RATE_CHANGE_SUMMARY =
  "The first-visit and continuing rates are shown separately. Any later material or fee change is prospective and will be sent in a retainable notice with a direct cancellation method before it takes effect. HomeAtlas operations target the California fee-change window of no fewer than 7 and no more than 30 days.";

function cents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enrollment prices must be greater than zero.");
  }
  return Math.round(value * 100);
}

export function normalizeEnrollmentEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function buildEnrollmentDocumentSnapshot(input: {
  presentation: PresentationData;
  tier: SqueegeeKingTierId;
  firstVisitPrice: number;
  recurringVisitPrice: number;
  annualizedValue: number;
  salesContext: EnrollmentSalesContext;
  homeSolicitationNoticeDays: 3 | 5 | null;
  createdAt?: string;
}): EnrollmentDocumentSnapshot {
  const customerEmail = normalizeEnrollmentEmail(input.presentation.clientEmail);
  if (!input.presentation.clientName.trim()) {
    throw new Error("Customer name is required before sending enrollment.");
  }
  if (!customerEmail) {
    throw new Error("A valid customer email is required for DocuSign.");
  }
  if (!input.presentation.clientAddress.trim()) {
    throw new Error("Service address is required before sending enrollment.");
  }
  if (
    input.salesContext === "customer_home" &&
    input.homeSolicitationNoticeDays !== 3 &&
    input.homeSolicitationNoticeDays !== 5
  ) {
    throw new Error(
      "Choose the attorney-approved 3-day or senior 5-day home-solicitation notice.",
    );
  }
  if (
    input.salesContext !== "customer_home" &&
    input.homeSolicitationNoticeDays !== null
  ) {
    throw new Error("A home-solicitation notice is only valid for a customer-home sale.");
  }

  const tier = SQUEEGEEKING_TIERS[input.tier];
  const carePlan =
    input.presentation.planMode === "custom" &&
    input.presentation.carePlan.tier === input.tier
      ? input.presentation.carePlan
      : createDefaultCarePlan({
          tier: input.tier,
          includeInterior: input.presentation.includeInterior,
          includeScreens: input.presentation.includeScreens,
        });
  const pricing = calculateCarePlanPricing({
    plan: carePlan,
    baseVisitPrice: input.recurringVisitPrice,
  });
  const fallbackVisitPriceCents = cents(input.recurringVisitPrice);
  const savings = enrollmentSavingsForPresentation(
    input.presentation,
    input.tier,
  );

  return {
    schemaVersion: 1,
    presentationId: input.presentation.id,
    customer: {
      name: input.presentation.clientName.trim(),
      email: customerEmail,
      phone: input.presentation.clientPhone.trim() || null,
    },
    property: {
      fullAddress: input.presentation.clientAddress.trim(),
      squareFeet:
        input.presentation.homeSqft > 0
          ? Math.round(input.presentation.homeSqft)
          : null,
      twoStory: input.presentation.twoStory,
    },
    plan: {
      tier: input.tier,
      tierLabel: tier.label,
      cadence: tier.frequency,
      visitsPerYear: tier.visitsPerYear,
      firstVisitPriceCents: cents(input.firstVisitPrice),
      recurringVisitPriceCents: fallbackVisitPriceCents,
      annualizedValueCents: cents(input.annualizedValue),
      addonDiscountPercent: tier.addonDiscount,
      summary: carePlan.summary,
      customerChoiceNote: carePlan.customerChoiceNote,
      visits: carePlan.visits.map((visit, index) => ({
        label: visit.label,
        timing: visit.timing,
        priceCents:
          pricing.visits[index] !== undefined
            ? cents(pricing.visits[index]!.total)
            : fallbackVisitPriceCents,
        interiorWindows: visit.interiorWindows,
        screens: visit.screens,
        cobwebRemoval: visit.cobwebRemoval,
        notes: visit.notes,
      })),
    },
    disclosures: {
      salesContext: input.salesContext,
      homeSolicitationNoticeDays: input.homeSolicitationNoticeDays,
      renewalSummary: ENROLLMENT_RENEWAL_SUMMARY,
      cancellationSummary: `${membershipCancellationReimbursementClause(savings)} Cancel with 30 days written notice using the email or online cancellation method shown in the agreement. Any additional California home-solicitation cancellation right controls during its applicable period.`,
      rateChangeSummary: ENROLLMENT_RATE_CHANGE_SUMMARY,
      billingSummary: MEMBERSHIP_BILLING_FINE_PRINT_BODY,
      billingConsent: membershipAgreementCheckboxText(),
    },
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function enrollmentScopePlainText(
  snapshot: EnrollmentDocumentSnapshot,
): string {
  return snapshot.plan.visits
    .map((visit) => {
      const services = [
        "Exterior windows: Included",
        `Interior windows: ${serviceStateLabel(visit.interiorWindows)}`,
        `Screens: ${serviceStateLabel(visit.screens)}`,
        `Cobweb removal: ${serviceStateLabel(visit.cobwebRemoval)}`,
      ].join("; ");
      return `${visit.label} (${visit.timing}) — ${services}${
        visit.notes ? `; Notes: ${visit.notes}` : ""
      }`;
    })
    .join("\n");
}
