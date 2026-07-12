export type VisitChargeLineKind = "membership_visit" | "addon_service";

export interface VisitChargeLineInput {
  id: string;
  kind: VisitChargeLineKind;
  serviceName: string;
  retailPrice: number;
  amountCharged: number;
}

export interface CompleteChargeVisitInput {
  membershipId: string;
  appointmentId?: string;
  serviceDate: string;
  lines: VisitChargeLineInput[];
  internalNote?: string;
}

export interface VisitChargeTotals {
  retailTotalCents: number;
  chargeTotalCents: number;
  savingsTotalCents: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

export function calculateVisitChargeTotals(
  lines: VisitChargeLineInput[],
): VisitChargeTotals {
  const totals = lines.reduce(
    (sum, line) => {
      sum.retailTotalCents += dollarsToCents(line.retailPrice);
      sum.chargeTotalCents += dollarsToCents(line.amountCharged);
      return sum;
    },
    { retailTotalCents: 0, chargeTotalCents: 0 },
  );

  return {
    ...totals,
    savingsTotalCents: Math.max(
      0,
      totals.retailTotalCents - totals.chargeTotalCents,
    ),
  };
}

export function validateCompleteChargeVisitInput(
  input: CompleteChargeVisitInput,
): string | null {
  if (!input.membershipId?.trim()) return "Membership is required.";
  if (!ISO_DATE_RE.test(input.serviceDate?.trim())) {
    return "Service date must use YYYY-MM-DD format.";
  }
  if (Number.isNaN(new Date(`${input.serviceDate}T12:00:00Z`).getTime())) {
    return "Service date is invalid.";
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return "Add at least one completed service.";
  }
  if (input.lines.length > 12) return "A visit can contain at most 12 services.";

  const ids = new Set<string>();
  for (const line of input.lines) {
    if (!line.id?.trim() || ids.has(line.id)) {
      return "Every service requires a unique line ID.";
    }
    ids.add(line.id);
    if (!line.serviceName?.trim()) return "Every service requires a name.";
    if (!Number.isFinite(line.retailPrice) || line.retailPrice <= 0) {
      return "Retail values must be greater than zero.";
    }
    if (!Number.isFinite(line.amountCharged) || line.amountCharged < 0) {
      return "Charged amounts must be zero or greater.";
    }
    if (line.amountCharged > line.retailPrice + 0.001) {
      return "A charged amount cannot exceed its retail value.";
    }
    if (line.kind === "membership_visit" && !input.appointmentId?.trim()) {
      return "A membership visit requires a scheduled appointment.";
    }
  }

  const totals = calculateVisitChargeTotals(input.lines);
  if (totals.chargeTotalCents <= 0) {
    return "The total charge must be greater than zero.";
  }
  if (totals.chargeTotalCents > 1_000_000) {
    return "The total charge exceeds the $10,000 safety limit.";
  }
  return null;
}

export function visitChargeOperationKey(input: {
  membershipId: string;
  appointmentId?: string;
  serviceDate: string;
}): string {
  const source = input.appointmentId?.trim() || input.serviceDate;
  return `visit:${input.membershipId.trim()}:${source}`;
}
