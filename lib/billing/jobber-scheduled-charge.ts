export type JobberScheduledChargeKind =
  | "one_off_job"
  | "recurring_per_visit"
  | "recurring_fixed_price";

export interface JobberScheduledChargeInput {
  externalJobId: string;
  externalVisitId: string;
  jobType: string | null;
  billingType: string | null;
  jobTotalCents: number | null;
  jobWillAutoCharge: boolean;
  visitInvoiceId: string | null;
  isLastScheduledVisit: boolean;
  isFirstVisitForJobInServiceMonth: boolean;
  serviceMonth: string;
}
export interface JobberScheduledChargeDecision {
  eligible: boolean;
  blockers: string[];
  amountCents: number | null;
  chargeKind: JobberScheduledChargeKind | null;
  billingUnitKey: string | null;
}

function normalized(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function jobKind(input: JobberScheduledChargeInput): JobberScheduledChargeKind | null {
  const jobType = normalized(input.jobType);
  const billingType = normalized(input.billingType);
  if (jobType.includes("one") && jobType.includes("off")) return "one_off_job";
  if (billingType.includes("visit")) return "recurring_per_visit";
  if (billingType.includes("fixed")) return "recurring_fixed_price";
  return null;
}

export function jobberScheduledChargeDecision(
  input: JobberScheduledChargeInput,
): JobberScheduledChargeDecision {
  const blockers: string[] = [];
  const chargeKind = jobKind(input);
  if (!input.externalJobId.trim()) blockers.push("jobber_job_id_missing");
  if (!input.externalVisitId.trim()) blockers.push("jobber_visit_id_missing");
  if (input.jobWillAutoCharge) blockers.push("jobber_automatic_payment_enabled");
  if (input.visitInvoiceId) blockers.push("jobber_visit_already_invoiced");
  if (!Number.isInteger(input.jobTotalCents) || input.jobTotalCents! <= 0) {
    blockers.push("jobber_job_price_missing");
  }
  if (!chargeKind) blockers.push("jobber_billing_strategy_unsupported");

  let billingUnitKey: string | null = null;
  if (chargeKind === "one_off_job") {
    if (!input.isLastScheduledVisit) blockers.push("one_off_job_waiting_for_last_visit");
    billingUnitKey = `job:${input.externalJobId}`;
  } else if (chargeKind === "recurring_per_visit") {
    billingUnitKey = `visit:${input.externalVisitId}`;
  } else if (chargeKind === "recurring_fixed_price") {
    if (!input.isFirstVisitForJobInServiceMonth) {
      blockers.push("fixed_price_job_already_represented_this_month");
    }
    billingUnitKey = `job:${input.externalJobId}:month:${input.serviceMonth}`;
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    amountCents: blockers.includes("jobber_job_price_missing")
      ? null
      : input.jobTotalCents,
    chargeKind,
    billingUnitKey,
  };
}
