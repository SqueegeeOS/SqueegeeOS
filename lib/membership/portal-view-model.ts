import {
  MEMBERSHIP_BILLING_REMINDER,
  PORTAL_EMPTY_COPY,
} from "@/lib/agreement/agreement-content";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import {
  FOUNDING_HOME_PROLOGUE,
  resolveFoundingMemberDisplay,
  type FoundingMemberDisplay,
} from "@/lib/membership/founding-member";
import { inferMembershipCadence } from "@/lib/membership/member-portal-status";
import { formatServiceTypeLabel } from "@/lib/membership/service-labels";
import {
  formatTierPrice,
  normalizeToSqueegeeKingTier,
  SQUEEGEEKING_TIERS,
  squeegeeKingTierLabel,
} from "@/lib/membership/tier-config";
import { resolvePortalPaymentState } from "@/lib/membership/portal-payment-state";
import {
  buildPortalNextCareVisit,
  type PortalNextCareVisit,
} from "@/lib/membership/portal-next-care-visit";
import { cumulativeMembershipEnrollmentSavings } from "@/lib/membership/enrollment-savings";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";

export type { PortalNextCareVisit };

export interface PortalTimelineEntry {
  id: string;
  monthYear: string;
  label: string;
  note: string | null;
}

export interface PortalCareRecordView {
  firstName: string;
  propertyName: string;
  propertyAddress: string;
  landingHeadline: string;
  storyHeadline: string;
  syncNote: string | null;
  foundingDisplay: FoundingMemberDisplay | null;
  foundingPrologue: string | null;
  membershipActive: boolean;
  pendingPayment: boolean;
  tierMemberLabel: string;
  memberSinceFormatted: string;
  visitPriceLabel: string;
  annualMathLabel: string | null;
  addonDiscountLabel: string | null;
  addonDiscountPercent: number | null;
  billingReminder: string;
  whatsNextHeadline: string;
  whatsNextSupport: string;
  cadenceNote: string;
  agreement: {
    planName: string;
    signedAtFormatted: string;
    pdfUrl: string | null;
  } | null;
  paymentOnFile: boolean;
  paymentMethodLabel: string | null;
  paymentHeadline: string;
  paymentSupport: string;
  paymentDetailLine: string;
  showUpdatePaymentMethod: boolean;
  propertyFacts: string[];
  timelineEntries: PortalTimelineEntry[];
  timelineEmptyCopy: string;
  photosEmptyCopy: string;
  showSavings: boolean;
  savingsLabel: string | null;
  completedVisitCount: number;
  membershipEnrollmentSavings: number | null;
  membershipSavingsTotal: number | null;
  membershipTierCareLabel: string;
  showHomeAtlasJourney: boolean;
  presentationId: string | null;
  membershipId: string | null;
  nextCareVisit: PortalNextCareVisit;
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatSignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatNextCareVisitHeadline(dateIso: string): string {
  const date = new Date(dateIso);
  const monthDay = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Next Care Visit — ${monthDay}`;
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function resolveSquareFootage(
  data: HomeCarePlanData,
  portalData: MemberPortalData | null | undefined,
): number | null {
  if (portalData?.property?.details?.squareFootage) {
    return portalData.property.details.squareFootage;
  }
  const sqftRow = data.propertyProfile.find((row) =>
    /sq\.?\s*ft|square\s*feet/i.test(row.label),
  );
  if (sqftRow?.value) {
    const parsed = parseInt(sqftRow.value.replace(/\D/g, ""), 10);
    if (parsed > 0) return parsed;
  }
  return null;
}

function buildTimelineEntries(
  appointments: MemberAppointmentSummary[],
): PortalTimelineEntry[] {
  return appointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => ({
      id: a.id,
      monthYear: formatMonthYear(a.date),
      label: formatServiceTypeLabel(a.serviceType),
      note: a.notes ?? null,
    }));
}

export function buildPortalCareRecordView(
  data: HomeCarePlanData,
  portalData: MemberPortalData | null | undefined,
): PortalCareRecordView {
  const firstName =
    portalData?.profile.firstName ?? data.homeowner.firstName ?? "Member";
  const propertyName =
    portalData?.propertyName ?? data.property.name ?? "Your home";
  const propertyAddress = portalData
    ? `${portalData.property.address}, ${portalData.property.city}`
    : `${data.property.address}, ${data.property.city}`;

  const salesTierSource =
    portalData?.salesTier ??
    portalData?.agreement?.planName ??
    portalData?.membershipPlanName ??
    data.memberships.find((tier) => tier.highlighted)?.id ??
    data.memberships[0]?.id ??
    data.property.membershipRecommendation ??
    null;
  const tierId = normalizeToSqueegeeKingTier(salesTierSource ?? "quarterly");
  const tierDef = SQUEEGEEKING_TIERS[tierId];
  const cadence = inferMembershipCadence(
    portalData?.agreement?.planName ??
      portalData?.membershipPlanName ??
      tierDef.label,
  );

  const visitPrice =
    portalData?.visitPrice && portalData.visitPrice > 0
      ? portalData.visitPrice
      : portalData?.monthlyRate && portalData.monthlyRate > 0
        ? portalData.monthlyRate
        : null;

  const visitsPerYear =
    portalData?.visitsPerYear && portalData.visitsPerYear > 0
      ? portalData.visitsPerYear
      : tierDef.visitsPerYear;

  const memberSinceIso =
    portalData?.memberSince ?? portalData?.profile.memberSince ?? new Date().toISOString();

  const paymentState = resolvePortalPaymentState({
    membershipStatus: portalData?.membershipStatus ?? "inactive",
    paymentSetupCompletedAt: portalData?.paymentSetupCompletedAt ?? null,
    paymentMethodLabel: portalData?.paymentMethodLabel ?? null,
    hasMembership: Boolean(portalData?.membershipId),
  });

  const membershipActive = paymentState.membershipActive;
  const pendingPayment = paymentState.pendingPayment;

  const nextAppt = portalData?.nextAppointment ?? null;
  const completedVisits = (portalData?.appointments ?? []).filter(
    (a) => a.status === "completed",
  );
  const hasVisitHistory = completedVisits.length > 0;

  const nextCareVisit = buildPortalNextCareVisit({
    membershipActive,
    nextAppointment: nextAppt,
    cadence: tierId,
  });

  const whatsNextHeadline = nextCareVisit.hasScheduledVisit && nextAppt
    ? formatNextCareVisitHeadline(nextAppt.date)
    : membershipActive
      ? nextCareVisit.emptyCopy
      : hasVisitHistory
        ? PORTAL_EMPTY_COPY.nextVisit
        : "We're preparing your next care visit.";

  const whatsNextSupport = nextCareVisit.hasScheduledVisit
    ? nextCareVisit.reassuranceCopy
    : membershipActive
      ? nextCareVisit.emptyCopy
      : PORTAL_EMPTY_COPY.nextVisit;

  const cadenceNote =
    cadence === "quarterly"
      ? "Quarterly members are visited every 3 months."
      : cadence === "bi-annual"
        ? "Bi-Annual members are visited every 6 months."
        : "Your visits follow your membership cadence.";

  const sqft = resolveSquareFootage(data, portalData);
  const propertyFacts: string[] = [];
  if (sqft) propertyFacts.push(`${sqft.toLocaleString()} sq ft`);
  propertyFacts.push(`${squeegeeKingTierLabel(tierId)} care`);
  propertyFacts.push(`Member since ${formatMemberSince(memberSinceIso)}`);

  const foundingDisplay = resolveFoundingMemberDisplay(
    portalData
      ? {
          foundingMember: portalData.foundingMember,
          memberSince: portalData.memberSince,
        }
      : null,
  );

  const lifetimeSavings = portalData?.lifetimeSavings.savings ?? 0;
  const showSavings = lifetimeSavings > 0;

  const membershipEnrollmentSavings =
    portalData?.membershipEnrollmentSavings != null &&
    portalData.membershipEnrollmentSavings > 0
      ? portalData.membershipEnrollmentSavings
      : null;

  const membershipSavingsTotal =
    membershipEnrollmentSavings != null
      ? cumulativeMembershipEnrollmentSavings(
          membershipEnrollmentSavings,
          completedVisits.length,
        )
      : null;

  const showHomeAtlasJourney =
    membershipActive && membershipEnrollmentSavings != null;

  const membershipTierCareLabel = `${squeegeeKingTierLabel(tierId)} Care`;

  const annualTotal =
    visitPrice != null ? visitPrice * visitsPerYear : null;

  return {
    firstName,
    propertyName,
    propertyAddress,
    landingHeadline: `${firstName}, ${propertyName} is under care.`,
    storyHeadline: hasVisitHistory
      ? `The story of ${propertyName} so far.`
      : PORTAL_EMPTY_COPY.storyHeadline,
    syncNote: portalData ? null : "Some details are still syncing.",
    foundingDisplay,
    foundingPrologue: foundingDisplay ? FOUNDING_HOME_PROLOGUE : null,
    membershipActive,
    pendingPayment,
    tierMemberLabel: `${squeegeeKingTierLabel(tierId)} Member`,
    memberSinceFormatted: formatMemberSince(memberSinceIso),
    visitPriceLabel:
      visitPrice != null ? `${formatTierPrice(visitPrice)} · per visit` : "",
    annualMathLabel:
      visitPrice != null && annualTotal != null
        ? `${formatTierPrice(visitPrice)} × ${visitsPerYear} visits = ${formatTierPrice(annualTotal)}/year`
        : null,
    addonDiscountLabel: `${tierDef.addonDiscount}% OFF add-ons`,
    addonDiscountPercent: tierDef.addonDiscount,
    billingReminder: MEMBERSHIP_BILLING_REMINDER,
    whatsNextHeadline,
    whatsNextSupport,
    cadenceNote: hasVisitHistory ? cadenceNote : cadenceNote,
    agreement: portalData?.agreement
      ? {
          planName: portalData.agreement.planName,
          signedAtFormatted: formatSignedDate(portalData.agreement.signedAt),
          pdfUrl: portalData.agreement.pdfUrl,
        }
      : membershipActive || pendingPayment
        ? {
            planName: portalData?.membershipPlanName ?? tierDef.label,
            signedAtFormatted: formatSignedDate(memberSinceIso),
            pdfUrl: null,
          }
        : null,
    paymentOnFile: paymentState.paymentOnFile,
    paymentMethodLabel: portalData?.paymentMethodLabel ?? null,
    paymentHeadline: paymentState.headline,
    paymentSupport: paymentState.support,
    paymentDetailLine: paymentState.detailLine,
    showUpdatePaymentMethod: paymentState.showUpdatePaymentMethod,
    propertyFacts,
    timelineEntries: buildTimelineEntries(portalData?.appointments ?? []),
    timelineEmptyCopy: PORTAL_EMPTY_COPY.timeline,
    photosEmptyCopy: PORTAL_EMPTY_COPY.photos,
    showSavings,
    savingsLabel: showSavings
      ? `${formatTierPrice(lifetimeSavings)} saved with membership`
      : null,
    completedVisitCount: completedVisits.length,
    membershipEnrollmentSavings,
    membershipSavingsTotal,
    membershipTierCareLabel,
    showHomeAtlasJourney,
    presentationId: portalData?.presentationId ?? null,
    membershipId: portalData?.membershipId ?? null,
    nextCareVisit,
  };
}
