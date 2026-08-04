export type SalesAttributionLifecycleStatus =
  | "pending"
  | "active"
  | "qualified"
  | "cancelled";

export interface SalesAttributionLifecycleDecision {
  targetStatus: SalesAttributionLifecycleStatus;
  qualifiesNow: boolean;
}

const CANCELLED_MEMBERSHIP_STATUSES = new Set([
  "cancelled",
  "archived",
  "inactive",
]);

function isDue(value: string | null, referenceDate: Date): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Sales attribution retention date is invalid.");
  }
  return timestamp <= referenceDate.getTime();
}

/**
 * Resolves the sales-credit state from the authoritative membership lifecycle.
 * A qualified retained member is never demoted merely because an active record
 * is reprocessed; cancellation remains authoritative.
 */
export function resolveSalesAttributionLifecycle(input: {
  membershipStatus: string;
  currentStatus: SalesAttributionLifecycleStatus;
  retentionQualifiesAt: string | null;
  referenceDate?: Date;
}): SalesAttributionLifecycleDecision {
  const referenceDate = input.referenceDate ?? new Date();

  if (CANCELLED_MEMBERSHIP_STATUSES.has(input.membershipStatus)) {
    return { targetStatus: "cancelled", qualifiesNow: false };
  }

  if (input.membershipStatus === "active") {
    if (input.currentStatus === "qualified") {
      return { targetStatus: "qualified", qualifiesNow: false };
    }
    if (isDue(input.retentionQualifiesAt, referenceDate)) {
      return { targetStatus: "qualified", qualifiesNow: true };
    }
    return { targetStatus: "active", qualifiesNow: false };
  }

  return {
    targetStatus: input.currentStatus,
    qualifiesNow: false,
  };
}
