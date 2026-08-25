import type { PaymentRail } from "@/lib/billing/payment-rail";
import type {
  EnrollmentDocumentSnapshot,
  EnrollmentVisitSnapshot,
} from "@/lib/enrollment/types";

export interface PublicEnrollmentAgreementVisit {
  label: string;
  timing: string;
  priceCents: number;
  includedServices: string[];
}

export interface PublicEnrollmentAgreementOption {
  label: string;
  priceCents: number | null;
}

export interface PublicEnrollmentAgreementSummary {
  visitsPerYear: number;
  annualTotalCents: number;
  planSummary: string;
  customerChoiceNote: string;
  visits: PublicEnrollmentAgreementVisit[];
  optionalAddOns: PublicEnrollmentAgreementOption[];
  paymentSummary: string;
}

const SERVICE_LABELS = {
  exteriorWindows: "Exterior window cleaning",
  interiorWindows: "Interior window cleaning",
  screens: "Standard window-screen cleaning",
  cobwebRemoval: "Exterior cobweb removal",
  solarPanels: "Solar panel cleaning",
  pressureWashing: "Pressure washing",
} as const;

type ServiceKey = keyof typeof SERVICE_LABELS;

const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceKey[];

function stateForVisit(
  visit: EnrollmentVisitSnapshot,
  service: ServiceKey,
): "included" | "optional" | "not_included" {
  if (service === "exteriorWindows") {
    return visit.exteriorWindows ?? "included";
  }
  if (service === "solarPanels" || service === "pressureWashing") {
    return visit[service] ?? "not_included";
  }
  return visit[service];
}

function paymentSummary(
  snapshot: EnrollmentDocumentSnapshot,
  paymentRail: PaymentRail,
): string {
  if (snapshot.payment?.arrangementSummary.trim()) {
    return snapshot.payment.arrangementSummary.trim();
  }
  return paymentRail === "manual_cash_check"
    ? "Payment is by cash or check. No card is stored and no automatic card billing is enabled."
    : "Card setup is completed securely through Stripe. HomeAtlas never receives the card number.";
}

export function buildPublicEnrollmentAgreementSummary(
  snapshot: EnrollmentDocumentSnapshot,
  paymentRail: PaymentRail,
): PublicEnrollmentAgreementSummary {
  const optionalServices = new Set<ServiceKey>();
  const visits = snapshot.plan.visits.map((visit) => {
    const includedServices: string[] = [];
    for (const service of SERVICE_KEYS) {
      const state = stateForVisit(visit, service);
      if (state === "included") includedServices.push(SERVICE_LABELS[service]);
      if (state === "optional") optionalServices.add(service);
    }
    return {
      label: visit.label,
      timing: visit.timing,
      priceCents: visit.priceCents,
      includedServices,
    };
  });

  return {
    visitsPerYear: snapshot.plan.visitsPerYear,
    annualTotalCents: snapshot.plan.annualizedValueCents,
    planSummary: snapshot.plan.summary,
    customerChoiceNote: snapshot.plan.customerChoiceNote,
    visits,
    optionalAddOns: SERVICE_KEYS.filter((service) =>
      optionalServices.has(service),
    ).map((service) => ({ label: SERVICE_LABELS[service], priceCents: null })),
    paymentSummary: paymentSummary(snapshot, paymentRail),
  };
}
