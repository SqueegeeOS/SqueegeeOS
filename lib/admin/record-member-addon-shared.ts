import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";
import { addonDiscountPercentForTier } from "@/lib/membership/tier-config";

export interface RecordMemberAddonInput {
  membershipId: string;
  serviceName: string;
  serviceDate: string;
  retailPrice: number;
  discountPercent: number;
  amountCharged: number;
  status: MemberAddonStatus;
  notes?: string;
}

const ADDON_STATUSES: MemberAddonStatus[] = [
  "quoted",
  "scheduled",
  "completed",
  "paid",
];

function validateServiceDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "Service date must use YYYY-MM-DD format";
  }
  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Service date is invalid";
  }
  return null;
}

export function defaultAddonDiscountForTier(
  tier: Parameters<typeof addonDiscountPercentForTier>[0],
): number {
  return addonDiscountPercentForTier(tier);
}

export function computeMemberAddonSavingsCents(input: {
  retailPriceCents: number;
  amountChargedCents: number;
}): number {
  return Math.max(0, input.retailPriceCents - input.amountChargedCents);
}

export function validateRecordMemberAddonInput(
  input: RecordMemberAddonInput,
): string | null {
  if (!input.membershipId.trim()) {
    return "Membership ID is required";
  }
  if (!input.serviceName.trim()) {
    return "Service name is required";
  }
  const dateError = validateServiceDate(input.serviceDate);
  if (dateError) return dateError;
  if (!Number.isFinite(input.retailPrice) || input.retailPrice <= 0) {
    return "Retail price must be greater than zero";
  }
  if (
    !Number.isFinite(input.discountPercent) ||
    input.discountPercent < 0 ||
    input.discountPercent > 100
  ) {
    return "Discount percent must be between 0 and 100";
  }
  if (!Number.isFinite(input.amountCharged) || input.amountCharged < 0) {
    return "Amount charged must be zero or greater";
  }
  if (input.amountCharged > input.retailPrice + 0.01) {
    return "Amount charged cannot exceed retail price";
  }
  if (!ADDON_STATUSES.includes(input.status)) {
    return "Status is invalid";
  }
  return null;
}
