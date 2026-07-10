import { formatTierPrice } from "@/lib/membership/tier-config";
import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";
import { MEMBER_ADDON_REVENUE_STATUSES } from "@/lib/persistence/types/member-addon";

export interface MemberCareAddonRecord {
  id: string;
  serviceName: string;
  serviceDate: string;
  amountCharged: number;
  saved: number;
  status: MemberAddonStatus;
}

export interface PortalCareAddonEntry {
  id: string;
  serviceName: string;
  dateLabel: string;
  amountPaidLabel: string;
  savingsLabel: string | null;
}

function formatAddonDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function mapMemberCareAddonRecord(row: {
  id: string;
  service_name: string;
  service_date: string;
  amount_charged_cents: number;
  saved_cents: number;
  status: MemberAddonStatus;
}): MemberCareAddonRecord {
  return {
    id: row.id,
    serviceName: row.service_name,
    serviceDate: row.service_date,
    amountCharged: Number(row.amount_charged_cents) / 100,
    saved: Number(row.saved_cents) / 100,
    status: row.status,
  };
}

export function buildPortalCareAddons(
  addons: MemberCareAddonRecord[],
): PortalCareAddonEntry[] {
  return addons
    .filter((addon) => MEMBER_ADDON_REVENUE_STATUSES.includes(addon.status))
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
    .map((addon) => ({
      id: addon.id,
      serviceName: addon.serviceName,
      dateLabel: formatAddonDate(addon.serviceDate),
      amountPaidLabel: formatTierPrice(addon.amountCharged),
      savingsLabel:
        addon.saved > 0
          ? `Member savings: ${formatTierPrice(addon.saved)}`
          : null,
    }));
}
