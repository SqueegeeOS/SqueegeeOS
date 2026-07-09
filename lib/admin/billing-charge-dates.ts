import type { BillingStatus } from "./billing-workspace-types";

export interface BillingObligationInput {
  targetWindowStart: string;
  status: string;
}

export interface BillingChargeRecordInput {
  serviceMonth: string;
  status: "paid" | "charged" | "failed" | "pending";
  chargedAt: string | null;
}

/** 1st of the calendar month containing the service window start. */
export function chargeDateForServiceWindow(windowStart: string): string {
  const [year, month] = windowStart.split("-");
  if (!year || !month) return windowStart;
  return `${year}-${month}-01`;
}

function currentYearMonth(referenceDate: Date): string {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function yearMonthFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function paidServiceMonthSet(paidServiceMonths: string[]): Set<string> {
  return new Set(paidServiceMonths.map((month) => month.slice(0, 7)));
}

export function resolveNextChargeDate(
  obligations: BillingObligationInput[],
  referenceDate = new Date(),
  paidServiceMonths: string[] = [],
): string | null {
  const paidMonths = paidServiceMonthSet(paidServiceMonths);
  const open = obligations
    .filter(
      (row) =>
        !["completed", "waived", "void", "credited"].includes(row.status),
    )
    .sort((a, b) => a.targetWindowStart.localeCompare(b.targetWindowStart));

  if (open.length === 0) return null;

  const todayYm = currentYearMonth(referenceDate);
  const today = referenceDate.toISOString().slice(0, 10);

  for (const obligation of open) {
    const chargeDate = chargeDateForServiceWindow(obligation.targetWindowStart);
    if (paidMonths.has(chargeDate.slice(0, 7))) continue;
    if (chargeDate >= today || yearMonthFromIsoDate(chargeDate) >= todayYm) {
      return chargeDate;
    }
  }

  for (const obligation of open) {
    const chargeDate = chargeDateForServiceWindow(obligation.targetWindowStart);
    if (!paidMonths.has(chargeDate.slice(0, 7))) {
      return chargeDate;
    }
  }

  return null;
}

export function resolveCurrentBillingPeriod(
  obligations: BillingObligationInput[],
  paidServiceMonths: string[] = [],
  referenceDate = new Date(),
): string | null {
  return resolveNextChargeDate(obligations, referenceDate, paidServiceMonths);
}

export function resolveLastChargeDate(
  charges: BillingChargeRecordInput[],
): string | null {
  const completed = charges
    .filter(
      (row) =>
        row.status === "paid" ||
        row.status === "charged" ||
        row.status === "failed",
    )
    .sort((a, b) => {
      const aTime = a.chargedAt ?? a.serviceMonth;
      const bTime = b.chargedAt ?? b.serviceMonth;
      return bTime.localeCompare(aTime);
    });

  const latest = completed[0];
  if (!latest) return null;
  return latest.chargedAt?.slice(0, 10) ?? latest.serviceMonth;
}

export function deriveBillingStatus(input: {
  membershipActive: boolean;
  paymentOnFile: boolean;
  nextChargeDate: string | null;
  latestChargeStatus: "paid" | "charged" | "failed" | "pending" | null;
  referenceDate?: Date;
}): BillingStatus {
  if (!input.membershipActive || !input.paymentOnFile) {
    return "inactive";
  }

  if (input.latestChargeStatus === "failed") {
    return "failed";
  }

  const periodPaid =
    input.latestChargeStatus === "paid" ||
    input.latestChargeStatus === "charged";

  if (periodPaid && input.nextChargeDate) {
    const ref = input.referenceDate ?? new Date();
    const currentYm = currentYearMonth(ref);
    const nextYm = yearMonthFromIsoDate(input.nextChargeDate);
    if (nextYm > currentYm) {
      return "upcoming";
    }
  }

  if (!input.nextChargeDate) {
    return "upcoming";
  }

  const ref = input.referenceDate ?? new Date();
  const currentYm = currentYearMonth(ref);
  const nextYm = yearMonthFromIsoDate(input.nextChargeDate);

  if (nextYm === currentYm) {
    return "ready_to_charge";
  }

  if (nextYm > currentYm) {
    return "upcoming";
  }

  return "ready_to_charge";
}

export function formatBillingStatusLabel(status: BillingStatus): string {
  switch (status) {
    case "ready_to_charge":
      return "Ready to Charge";
    case "charged":
      return "Charged";
    case "failed":
      return "Failed";
    case "upcoming":
      return "Upcoming";
    case "inactive":
      return "Inactive";
    default:
      return status;
  }
}
