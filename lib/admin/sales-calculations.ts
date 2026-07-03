import type {
  ClosedJob,
  ClosedJobRow,
  ExecutiveStats,
  MonthlyLedgerEntry,
  RecurringFrequency,
  RevenueChartSeries,
  RevenuePeriodFilter,
} from "./closed-jobs-types";
import { RECURRING_FREQUENCIES } from "./closed-jobs-types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDisplayDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatRecurringFrequency(
  frequency: RecurringFrequency | null,
): string {
  if (!frequency) return "—";
  return (
    RECURRING_FREQUENCIES.find((item) => item.value === frequency)?.label ??
    frequency
  );
}

export function getMonthKey(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function parseClosedDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

/** Cash collected at close — always the sale amount */
export function getImmediateRevenue(job: ClosedJob): number {
  return job.saleAmount;
}

/** Annual contract value — recurring memberships only */
export function getArrValue(job: ClosedJob): number {
  if (job.saleType !== "recurring_membership") return 0;
  return annualizeRecurring(job.saleAmount, job.recurringFrequency);
}

/** Business value created — immediate revenue + ARR generated */
export function getMonthlySalesPerformance(job: ClosedJob): number {
  return getImmediateRevenue(job) + getArrValue(job);
}

export function annualizeRecurring(
  amount: number,
  frequency: RecurringFrequency | null,
): number {
  if (!frequency) return 0;
  switch (frequency) {
    case "monthly":
      return amount * 12;
    case "quarterly":
      return amount * 4;
    case "bi_annual":
      return amount * 2;
    case "annual":
      return amount;
    default:
      return 0;
  }
}

export function filterJobsByPeriod(
  jobs: ClosedJob[],
  filter: RevenuePeriodFilter,
  referenceDate = new Date(),
): ClosedJob[] {
  switch (filter) {
    case "current_month":
      return jobs.filter(
        (job) => getMonthKey(job.closedDate) === getMonthKey(referenceDate),
      );
    case "last_30_days": {
      const cutoff = new Date(referenceDate);
      cutoff.setHours(12, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - 30);
      return jobs.filter((job) => parseClosedDate(job.closedDate) >= cutoff);
    }
    case "year":
      return jobs.filter(
        (job) =>
          parseClosedDate(job.closedDate).getFullYear() ===
          referenceDate.getFullYear(),
      );
    case "all_time":
      return jobs;
  }
}

function countUniqueCustomers(jobs: ClosedJob[]): number {
  return new Set(jobs.map((job) => job.customerName.trim().toLowerCase())).size;
}

export function computeMonthlyLedger(jobs: ClosedJob[]): MonthlyLedgerEntry[] {
  const byMonth = new Map<string, ClosedJob[]>();

  for (const job of jobs) {
    const key = getMonthKey(job.closedDate);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(job);
    byMonth.set(key, bucket);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, monthJobs]) => {
      const revenueCollected = monthJobs.reduce(
        (sum, job) => sum + getImmediateRevenue(job),
        0,
      );
      const arrGenerated = monthJobs.reduce(
        (sum, job) => sum + getArrValue(job),
        0,
      );
      const recurringJobs = monthJobs.filter(
        (job) => job.saleType === "recurring_membership",
      );

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        revenueCollected,
        arrGenerated,
        monthlySalesPerformance: revenueCollected + arrGenerated,
        closedJobsCount: monthJobs.length,
        membershipsSold: recurringJobs.length,
        averageTicket:
          monthJobs.length > 0 ? revenueCollected / monthJobs.length : 0,
        newCustomers: countUniqueCustomers(monthJobs),
      };
    });
}

export function computeExecutiveStats(
  jobs: ClosedJob[],
  platformCounts?: {
    activeMembers?: number;
    homeCarePlansCreated?: number;
    pendingRequests?: number;
    signedAgreements?: number;
  },
): ExecutiveStats {
  const revenueCollected = jobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const arrGenerated = jobs.reduce((sum, job) => sum + getArrValue(job), 0);
  const recurringJobs = jobs.filter(
    (job) => job.saleType === "recurring_membership",
  );

  return {
    revenueCollected,
    arrGenerated,
    monthlySalesPerformance: revenueCollected + arrGenerated,
    newCustomers: countUniqueCustomers(jobs),
    jobsClosed: jobs.length,
    membershipsSold: recurringJobs.length,
    averageTicket: jobs.length > 0 ? revenueCollected / jobs.length : 0,
    activeMembers: platformCounts?.activeMembers ?? 0,
    homeCarePlansCreated: platformCounts?.homeCarePlansCreated ?? 0,
    pendingRequests: platformCounts?.pendingRequests ?? 0,
    signedAgreements: platformCounts?.signedAgreements ?? 0,
    closeRatePlaceholder: "—",
  };
}

export function computeRevenueChartSeries(
  jobs: ClosedJob[],
  maxMonths = 12,
): RevenueChartSeries {
  const ledger = computeMonthlyLedger(jobs)
    .slice(0, maxMonths)
    .reverse();

  return {
    revenueCollected: ledger.map((entry) => ({
      label: entry.monthLabel.split(" ")[0],
      value: entry.revenueCollected,
    })),
    arrGenerated: ledger.map((entry) => ({
      label: entry.monthLabel.split(" ")[0],
      value: entry.arrGenerated,
    })),
    monthlySalesPerformance: ledger.map((entry) => ({
      label: entry.monthLabel.split(" ")[0],
      value: entry.monthlySalesPerformance,
    })),
  };
}

export function closedJobFromRow(row: ClosedJobRow): ClosedJob {
  return {
    id: row.id,
    customerName: row.customer_name,
    propertyAddress: row.property_address,
    saleAmount: Number(row.sale_amount),
    saleType: row.sale_type,
    recurringFrequency: row.recurring_frequency,
    serviceCategory: row.service_category,
    closedDate: row.closed_date,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    createdBy: row.created_by,
    status: "closed",
    source: "supabase",
  };
}

export function sortClosedJobsDesc(jobs: ClosedJob[]): ClosedJob[] {
  return [...jobs].sort((a, b) => {
    const dateCompare = b.closedDate.localeCompare(a.closedDate);
    if (dateCompare !== 0) return dateCompare;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function mergeClosedJobs(
  primary: ClosedJob[],
  secondary: ClosedJob[],
): ClosedJob[] {
  const map = new Map<string, ClosedJob>();
  for (const job of [...primary, ...secondary]) {
    map.set(job.id, job);
  }
  return sortClosedJobsDesc([...map.values()]);
}
