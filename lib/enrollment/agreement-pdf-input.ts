import type { GenerateSignedPDFInput } from "@/lib/agreement/generate-signed-pdf";
import { planNameForAgreement } from "@/lib/membership/tier-config";
import { parseClientAddress } from "@/lib/presentations/parse-client-address";
import {
  DEFAULT_CARE_PLAN_SERVICE_PRICES,
  PRESENTATION_CARE_PLAN_VERSION,
} from "@/lib/presentations/care-plan";
import type { EnrollmentDocumentSnapshot } from "./types";

/** The frozen packet, not a mutable presentation, is the source for both PDFs. */
export function enrollmentAgreementPdfInput(
  snapshot: EnrollmentDocumentSnapshot,
): Omit<GenerateSignedPDFInput, "signedAt" | "signatureDataUrl"> {
  const recurringVisitPrice = snapshot.plan.recurringVisitPriceCents / 100;
  const carePlan = {
    version: PRESENTATION_CARE_PLAN_VERSION,
    tier: snapshot.plan.tier,
    summary: snapshot.plan.summary,
    customerChoiceNote: snapshot.plan.customerChoiceNote,
    servicePrices: { ...DEFAULT_CARE_PLAN_SERVICE_PRICES },
    visits: snapshot.plan.visits.map((visit, index) => ({
      id: `visit_${index + 1}`,
      label: visit.label,
      timing: visit.timing,
      exteriorWindows: visit.exteriorWindows ?? ("included" as const),
      interiorWindows: visit.interiorWindows,
      screens: visit.screens,
      cobwebRemoval: visit.cobwebRemoval,
      solarPanels: visit.solarPanels ?? ("not_included" as const),
      pressureWashing: visit.pressureWashing ?? ("not_included" as const),
      notes: visit.notes,
      priceOverride: visit.priceCents / 100,
    })),
  };

  return {
    memberName: snapshot.signer?.name ?? snapshot.customer.name,
    tier: planNameForAgreement(snapshot.plan.tier),
    agreementTier: snapshot.plan.tier,
    propertyName: parseClientAddress(
      snapshot.property.fullAddress,
      snapshot.customer.name,
    ).propertyName,
    monthlyPrice: recurringVisitPrice,
    homeSqft: snapshot.property.squareFeet ?? undefined,
    twoStory: snapshot.property.twoStory,
    includeScreens: snapshot.plan.visits.every(
      (visit) => visit.screens === "included",
    ),
    includeInterior: snapshot.plan.visits.every(
      (visit) => visit.interiorWindows === "included",
    ),
    carePlan,
    carePlanPricing: {
      baseVisitPrice: recurringVisitPrice,
      annualTotal: snapshot.plan.annualizedValueCents / 100,
      averageVisitPrice:
        snapshot.plan.annualizedValueCents / 100 / snapshot.plan.visitsPerYear,
      visits: snapshot.plan.visits.map((visit, index) => ({
        id: `visit_${index + 1}`,
        label: visit.label,
        total: visit.priceCents / 100,
        usedOverride: true,
      })),
    },
    annualPrice: snapshot.plan.annualizedValueCents / 100,
    enrollmentDisclosures: {
      billingSummary: snapshot.disclosures.billingSummary,
      billingConsent: snapshot.disclosures.billingConsent,
      cancellationSummary: snapshot.disclosures.cancellationSummary,
      renewalSummary: snapshot.disclosures.renewalSummary,
      rateChangeSummary: snapshot.disclosures.rateChangeSummary,
    },
  };
}
