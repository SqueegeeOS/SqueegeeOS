import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import type { MemberSavingsEntry } from "@/lib/member-intelligence/types";
import { formatTierPrice } from "@/lib/membership/tier-config";
import { servicesForTier } from "@/lib/membership/tier-config";
import type { MemberMembershipView } from "./resolve-member-membership";

export interface MemberSavingsLine {
  label: string;
  amount: number;
}

export interface MemberSavingsSummary {
  totalSaved: number;
  savedThisYear: number;
  lines: MemberSavingsLine[];
  source: "live" | "plan";
  footnote: string;
}

function monthsSince(iso: string, reference = new Date()): number {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 6;
  const months =
    (reference.getFullYear() - start.getFullYear()) * 12 +
    (reference.getMonth() - start.getMonth());
  return Math.max(1, months);
}

function groupSavingsByService(
  entries: MemberSavingsEntry[],
): MemberSavingsLine[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(
      entry.serviceType,
      (totals.get(entry.serviceType) ?? 0) + entry.saved,
    );
  }
  return Array.from(totals.entries())
    .map(([label, amount]) => ({ label, amount: Math.round(amount * 100) / 100 }))
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function estimatePlanSavingsToDate(
  membership: MemberMembershipView,
  reference = new Date(),
): number {
  const annualSavings = Math.max(0, membership.value.annualDelta);
  if (annualSavings <= 0) return 0;
  const months = monthsSince(membership.memberSince, reference);
  return Math.round(annualSavings * (months / 12));
}

function estimateVisitSavings(membership: MemberMembershipView): number {
  const completed = membership.schedule.completedCount;
  if (completed <= 0) return 0;

  const services = servicesForTier(membership.tier);
  if (services.length === 0) return 0;

  const avgRetail =
    services.reduce((sum, s) => sum + s.retailPerVisit, 0) / services.length;
  const savingsPerVisit = Math.max(0, avgRetail - membership.monthlyPrice);
  return Math.round(completed * savingsPerVisit);
}

function estimateYtdFromPlan(
  membership: MemberMembershipView,
  reference = new Date(),
): number {
  const annualSavings = Math.max(0, membership.value.annualDelta);
  if (annualSavings <= 0) return 0;
  const yearFraction = (reference.getMonth() + 1) / 12;
  return Math.round(annualSavings * yearFraction);
}

function estimateSavedThisYear(
  membership: MemberMembershipView,
  reference = new Date(),
): number {
  const fromPlan = estimateYtdFromPlan(membership, reference);
  if (fromPlan > 0) return fromPlan;
  return estimateVisitSavings(membership);
}

export function buildMemberSavingsSummary(
  membership: MemberMembershipView,
  portalData?: MemberPortalData | null,
  referenceDate = new Date(),
): MemberSavingsSummary {
  const planSavingsToDate = estimatePlanSavingsToDate(membership, referenceDate);
  const visitSavings = estimateVisitSavings(membership);

  if (portalData?.profile) {
    const trackedLifetime = Math.max(
      portalData.profile.totalSaved,
      portalData.lifetimeSavings.savings,
    );
    const savedThisYear = portalData.ytdSavings.savings;
    const serviceLines = groupSavingsByService(portalData.lifetimeSavings.entries);

    const lines: MemberSavingsLine[] = [];
    if (planSavingsToDate > 0) {
      lines.push({ label: "Membership plan value", amount: planSavingsToDate });
    }
    lines.push(...serviceLines);

    const totalSaved =
      trackedLifetime > 0
        ? trackedLifetime
        : Math.round(planSavingsToDate + savedThisYear + visitSavings);

    return {
      totalSaved,
      savedThisYear: savedThisYear > 0 ? savedThisYear : estimateSavedThisYear(membership, referenceDate),
      lines: lines.length > 0 ? lines : [{ label: "Member pricing", amount: totalSaved }],
      source: trackedLifetime > 0 || savedThisYear > 0 ? "live" : "plan",
      footnote:
        trackedLifetime > 0 || savedThisYear > 0
          ? "Tracked from your completed visits and add-on services."
          : "Estimated from your plan benefits until visit history is recorded.",
    };
  }

  const savedThisYear = estimateSavedThisYear(membership, referenceDate);
  const totalSaved = Math.round(planSavingsToDate + visitSavings);
  const lines: MemberSavingsLine[] = [];

  if (planSavingsToDate > 0) {
    lines.push({ label: "Membership vs retail", amount: planSavingsToDate });
  }
  if (visitSavings > 0) {
    lines.push({ label: "Completed visit savings", amount: visitSavings });
  }

  return {
    totalSaved,
    savedThisYear,
    lines,
    source: "plan",
    footnote:
      "Estimated from your plan tier and completed visits. Totals update when visits are logged.",
  };
}

export function formatMemberSavingsHeadline(amount: number): string {
  return formatTierPrice(amount);
}
