import type { ClosedJob, ClosedJobInput, ClosedJobRow } from "./closed-jobs-types";
import { closedJobFromRow } from "./sales-calculations";

export const CLOSED_JOBS_LOCAL_KEY = "squeegeeking:closed-jobs";

export function loadLocalClosedJobs(): ClosedJob[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CLOSED_JOBS_LOCAL_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ClosedJob[];
  } catch {
    return [];
  }
}

export function saveLocalClosedJobs(jobs: ClosedJob[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLOSED_JOBS_LOCAL_KEY, JSON.stringify(jobs));
}

export function appendLocalClosedJob(job: ClosedJob): ClosedJob[] {
  const jobs = loadLocalClosedJobs();
  const next = [job, ...jobs.filter((item) => item.id !== job.id)];
  saveLocalClosedJobs(next);
  return next;
}

export function createLocalClosedJob(
  input: ClosedJobInput,
  id = crypto.randomUUID(),
): ClosedJob {
  return {
    id,
    customerName: input.customerName.trim(),
    propertyAddress: input.propertyAddress.trim(),
    saleAmount: input.saleAmount,
    saleType: input.saleType,
    recurringFrequency:
      input.saleType === "recurring_membership" ? input.recurringFrequency : null,
    serviceCategory: input.serviceCategory,
    closedDate: input.closedDate,
    notes: input.notes.trim(),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? null,
    status: "closed",
    source: "local",
  };
}

export function validateClosedJobInput(input: ClosedJobInput): string | null {
  if (!input.customerName.trim()) return "Customer name is required.";
  if (!input.propertyAddress.trim()) return "Property address is required.";
  if (!Number.isFinite(input.saleAmount) || input.saleAmount <= 0) {
    return "Sale amount must be greater than zero.";
  }
  if (!input.closedDate) return "Closed date is required.";
  if (
    input.saleType === "recurring_membership" &&
    !input.recurringFrequency
  ) {
    return "Select a recurring frequency for membership sales.";
  }
  if (
    input.saleType === "one_time" &&
    input.recurringFrequency
  ) {
    return "One-time jobs should not include a recurring frequency.";
  }
  return null;
}

export function closedJobInputToRow(
  input: ClosedJobInput,
  id: string,
): Omit<ClosedJobRow, "created_at"> & { created_at?: string } {
  return {
    id,
    customer_name: input.customerName.trim(),
    property_address: input.propertyAddress.trim(),
    sale_amount: input.saleAmount,
    sale_type: input.saleType,
    recurring_frequency:
      input.saleType === "recurring_membership" ? input.recurringFrequency : null,
    service_category: input.serviceCategory,
    closed_date: input.closedDate,
    notes: input.notes.trim(),
    created_by: input.createdBy ?? null,
    status: "closed",
  };
}

export { closedJobFromRow };
