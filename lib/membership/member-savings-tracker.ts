import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import type { MemberSavingsEntry } from "@/lib/member-intelligence/types";
import { formatTierPrice } from "@/lib/membership/tier-config";
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

const EMPTY_SAVINGS_FOOTNOTE =
  "Savings from completed visits appear here after your first service.";

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

function emptySavingsSummary(source: "live" | "plan"): MemberSavingsSummary {
  return {
    totalSaved: 0,
    savedThisYear: 0,
    lines: [],
    source,
    footnote: EMPTY_SAVINGS_FOOTNOTE,
  };
}

export function buildMemberSavingsSummary(
  _membership: MemberMembershipView,
  portalData?: MemberPortalData | null,
  _referenceDate = new Date(),
): MemberSavingsSummary {
  if (!portalData?.profile) {
    return emptySavingsSummary("plan");
  }

  const trackedLifetime = Math.max(
    portalData.profile.totalSaved,
    portalData.lifetimeSavings.savings,
  );
  const savedThisYear = portalData.ytdSavings.savings;
  const serviceLines = groupSavingsByService(portalData.lifetimeSavings.entries);

  if (trackedLifetime <= 0 && savedThisYear <= 0 && serviceLines.length === 0) {
    return emptySavingsSummary("live");
  }

  return {
    totalSaved: trackedLifetime,
    savedThisYear,
    lines: serviceLines,
    source: "live",
    footnote: "Tracked from your completed visits and add-on services.",
  };
}

export function formatMemberSavingsHeadline(amount: number): string {
  return formatTierPrice(amount);
}
