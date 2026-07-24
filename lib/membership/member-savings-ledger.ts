import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import type { MemberCareAddonRecord } from "@/lib/membership/portal-care-addons";
import { MEMBER_ADDON_REVENUE_STATUSES } from "@/lib/persistence/types/member-addon";
import { formatTierPrice, squeegeeKingTierLabel } from "@/lib/membership/tier-config";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export type SavingsLedgerEntryType = "membership_visit" | "addon_service";

export interface SavingsLedgerLine {
  id: string;
  entryType: SavingsLedgerEntryType;
  label: string;
  amount: number;
  occurredAt: string;
  detail: string | null;
}

export interface SavingsLedgerCategory {
  total: number;
  headline: string;
  support: string;
  lines: SavingsLedgerLine[];
}

export interface MemberSavingsLedgerView {
  totalServiceSavings: number;
  totalServiceSavingsLabel: string;
  membershipVisits: SavingsLedgerCategory;
  addonServices: SavingsLedgerCategory;
  hasAnySavings: boolean;
}

function formatLedgerDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMembershipVisitLines(input: {
  appointments: MemberAppointmentSummary[];
  enrollmentSavingsPerVisit: number;
  tierId: SqueegeeKingTierId;
}): SavingsLedgerLine[] {
  if (input.enrollmentSavingsPerVisit <= 0) return [];

  return input.appointments
    .filter((appointment) => appointment.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((appointment) => ({
      id: `visit-${appointment.id}`,
      entryType: "membership_visit" as const,
      label: `${squeegeeKingTierLabel(input.tierId)} membership visit`,
      amount: input.enrollmentSavingsPerVisit,
      occurredAt: appointment.date,
      detail: `Saved ${formatTierPrice(input.enrollmentSavingsPerVisit)} vs one-time pricing`,
    }));
}

function buildAddonLines(addons: MemberCareAddonRecord[]): SavingsLedgerLine[] {
  return addons
    .filter((addon) => MEMBER_ADDON_REVENUE_STATUSES.includes(addon.status))
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
    .map((addon) => ({
      id: `addon-${addon.id}`,
      entryType: "addon_service" as const,
      label: addon.serviceName,
      amount: addon.saved,
      occurredAt: `${addon.serviceDate}T12:00:00.000Z`,
      detail:
        addon.saved > 0
          ? `Member price ${formatTierPrice(addon.amountCharged)} · saved ${formatTierPrice(addon.saved)}`
          : null,
    }));
}

export function buildMemberSavingsLedgerView(input: {
  tierId: SqueegeeKingTierId;
  addonDiscountPercent: number;
  enrollmentSavingsPerVisit: number | null;
  appointments: MemberAppointmentSummary[];
  careAddons: MemberCareAddonRecord[];
  persistedLines?: SavingsLedgerLine[];
}): MemberSavingsLedgerView {
  const enrollmentPerVisit = input.enrollmentSavingsPerVisit ?? 0;
  const persistedMembershipLines = input.persistedLines?.filter(
    (line) => line.entryType === "membership_visit",
  );
  const persistedAddonLines = input.persistedLines?.filter(
    (line) => line.entryType === "addon_service",
  );

  const membershipLines =
    persistedMembershipLines && persistedMembershipLines.length > 0
      ? persistedMembershipLines
      : buildMembershipVisitLines({
          appointments: input.appointments,
          enrollmentSavingsPerVisit: enrollmentPerVisit,
          tierId: input.tierId,
        });

  const addonLines =
    persistedAddonLines && persistedAddonLines.length > 0
      ? persistedAddonLines
      : buildAddonLines(input.careAddons);

  const membershipTotal = membershipLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );
  const addonTotal = addonLines.reduce((sum, line) => sum + line.amount, 0);
  const totalServiceSavings = Math.round((membershipTotal + addonTotal) * 100) / 100;

  return {
    totalServiceSavings,
    totalServiceSavingsLabel: formatTierPrice(totalServiceSavings),
    membershipVisits: {
      total: membershipTotal,
      headline: "Membership visit savings",
      support:
        enrollmentPerVisit > 0
          ? `${formatTierPrice(enrollmentPerVisit)} saved per completed visit vs one-time pricing when you joined ${squeegeeKingTierLabel(input.tierId)}.`
          : "Savings from completed membership visits appear here after service.",
      lines: membershipLines,
    },
    addonServices: {
      total: addonTotal,
      headline: "Add-on service savings",
      support: `${input.addonDiscountPercent}% member discount on add-on services — applied when you book extra care.`,
      lines: addonLines,
    },
    hasAnySavings: totalServiceSavings > 0,
  };
}

export function formatLedgerLineDate(iso: string): string {
  return formatLedgerDate(iso);
}
