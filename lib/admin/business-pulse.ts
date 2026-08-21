import {
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "./company-business-timezone";
import {
  isMembershipActive as isCanonicalMembershipActive,
  isMembershipCancelled,
} from "@/lib/membership/membership-status";

export type BusinessPulsePeriod =
  | "current_month"
  | "last_30_days"
  | "quarter"
  | "year";

export const BUSINESS_PULSE_PERIODS: Array<{
  value: BusinessPulsePeriod;
  label: string;
}> = [
  { value: "current_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export interface BusinessPulseRange {
  preset: BusinessPulsePeriod;
  label: string;
  startUtc: string;
  endUtc: string;
  startCalendarDate: string;
  endCalendarDateExclusive: string;
}

export interface BusinessPulseJobRow {
  external_job_id: string;
  external_property_id: string | null;
  job_number: number | null;
  title: string | null;
  client_name: string | null;
  scheduled_start: string;
  is_complete: boolean;
  job_total_cents: number | null;
  visit_invoice_status: string | null;
  source_observed_at: string | null;
  updated_at: string;
}

export interface BusinessPulseMonthlyJobRow {
  external_job_id: string;
  scheduled_start: string;
  job_total_cents: number | null;
  visit_invoice_status: string | null;
}

export interface BusinessPulseMonthlyRevenuePoint {
  year: number;
  month: number;
  monthKey: string;
  monthLabel: string;
  paidRevenueCents: number;
  paidJobs: number;
  arrAddedCents: number;
  membershipsSold: number;
  hasSourceCoverage: boolean;
  hasArrCoverage: boolean;
  isFutureMonth: boolean;
  revenueYearOverYear: BusinessPulseYearOverYearComparison;
  arrYearOverYear: BusinessPulseYearOverYearComparison;
}

export interface BusinessPulseYearOverYearComparison {
  priorYear: number;
  priorValueCents: number | null;
  percentChange: number | null;
  status: "up" | "down" | "flat" | "new" | "unavailable";
  comparisonKind: "full_month" | "month_to_date";
  throughDay: number | null;
}

export interface BusinessPulseMembershipRow {
  id: string;
  property_id: string;
  agreement_id: string | null;
  status: string;
  annual_rate: number | null;
  visit_price: number | null;
  visits_per_year: number | null;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
  stripe_customer_id: string | null;
  payment_rail: "stripe_card" | "manual_cash_check" | null;
  manual_payment_approved_at: string | null;
  manual_payment_approved_by: string | null;
}

export interface BusinessPulseAgreementRow {
  id: string;
  membership_id: string | null;
  homeowner_name: string;
  signed_at: string;
}

export interface BusinessPulsePropertyLinkRow {
  external_property_id: string;
  membership_id: string;
  property_id: string;
  link_state: string;
}

export interface BusinessPulseBillingChargeRow {
  status: string;
  amount: number | null;
  amount_collected: number | null;
  charged_at: string | null;
}

export interface BusinessPulseAddonRow {
  status: string;
  amount_charged_cents: number;
  service_date: string;
}

export interface BusinessPulseLeadRow {
  source: string;
  submitted_at: string;
}

export interface BusinessPulseRecentJob {
  externalJobId: string;
  jobNumber: number | null;
  customerName: string;
  title: string;
  serviceAt: string;
  amountCents: number;
  invoiceStatus: string;
  completed: boolean;
  membershipAssociated: boolean;
}

export interface BusinessPulseMembershipSale {
  membershipId: string;
  customerName: string;
  signedAt: string;
  annualizedValueCents: number;
}

export interface BusinessPulseSourceHealth {
  label: string;
  status: "healthy" | "attention" | "idle" | "not_connected";
  lastEventAt: string | null;
  detail: string;
}

export interface BusinessPulseSnapshot {
  generatedAt: string;
  source: "supabase" | "unavailable";
  range: BusinessPulseRange;
  metrics: {
    paidWorkValueCents: number;
    completedWorkValueCents: number;
    bookedWorkValueCents: number;
    membershipPaidWorkValueCents: number;
    unclassifiedPaidWorkValueCents: number;
    homeAtlasMembershipCollectedCents: number;
    activeArrCents: number;
    arrAddedCents: number;
    activeMembers: number;
    membershipsSold: number;
    leads: number;
    jobsBooked: number;
    jobsCompleted: number;
    jobsMarkedPaid: number;
    classifiedJobs: number;
    unclassifiedJobs: number;
  };
  monthlyRevenue: {
    currentYear: number;
    years: number[];
    points: BusinessPulseMonthlyRevenuePoint[];
    earliestRecordedMonth: string | null;
    earliestArrMonth: string | null;
  };
  leadMix: Array<{ source: string; count: number }>;
  recentJobs: BusinessPulseRecentJob[];
  recentMembershipSales: BusinessPulseMembershipSale[];
  sources: {
    homeAtlas: BusinessPulseSourceHealth;
    jobber: BusinessPulseSourceHealth;
    stripe: BusinessPulseSourceHealth;
    goHighLevel: BusinessPulseSourceHealth;
  };
  warnings: string[];
  definitions: Array<{ label: string; definition: string }>;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function addCalendarDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function startOfMonth(calendarDate: string): string {
  return `${calendarDate.slice(0, 7)}-01`;
}

function addCalendarMonths(calendarDate: string, months: number): string {
  const [year, month] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1))
    .toISOString()
    .slice(0, 10);
}

export function resolveBusinessPulseRange(
  preset: BusinessPulsePeriod,
  reference: Date = new Date(),
): BusinessPulseRange {
  const today = formatBusinessCalendarDate(reference);
  let startCalendarDate: string;
  let endCalendarDateExclusive: string;
  let label: string;

  if (preset === "last_30_days") {
    startCalendarDate = addCalendarDays(today, -29);
    endCalendarDateExclusive = addCalendarDays(today, 1);
    label = "Last 30 days";
  } else if (preset === "quarter") {
    const [year, month] = today.split("-").map(Number);
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    startCalendarDate = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`;
    endCalendarDateExclusive = addCalendarMonths(startCalendarDate, 3);
    label = "This quarter";
  } else if (preset === "year") {
    startCalendarDate = `${today.slice(0, 4)}-01-01`;
    endCalendarDateExclusive = `${Number(today.slice(0, 4)) + 1}-01-01`;
    label = "This year";
  } else {
    startCalendarDate = startOfMonth(today);
    endCalendarDateExclusive = addCalendarMonths(startCalendarDate, 1);
    label = "This month";
  }

  return {
    preset,
    label,
    startCalendarDate,
    endCalendarDateExclusive,
    startUtc: zonedDateTimeToUtc(startCalendarDate, 0, 0, 0).toISOString(),
    endUtc: zonedDateTimeToUtc(
      endCalendarDateExclusive,
      0,
      0,
      0,
    ).toISOString(),
  };
}

function yearlyValueCents(row: BusinessPulseMembershipRow): number {
  const annual = Number(row.annual_rate ?? 0);
  if (Number.isFinite(annual) && annual > 0) return Math.round(annual * 100);
  const visit = Number(row.visit_price ?? 0);
  const visits = Number(row.visits_per_year ?? 0);
  return Number.isFinite(visit) && Number.isFinite(visits) && visit > 0 && visits > 0
    ? Math.round(visit * visits * 100)
    : 0;
}

function isCancelled(status: string): boolean {
  return status.toLowerCase() === "archived" || isMembershipCancelled({ status });
}

function isActiveMembership(row: BusinessPulseMembershipRow): boolean {
  return isCanonicalMembershipActive({
    status: row.status,
    agreement_id: row.agreement_id,
    visit_price: row.visit_price,
    payment_setup_completed_at: row.payment_setup_completed_at,
    stripe_payment_method_id: row.stripe_payment_method_id,
    stripe_customer_id: row.stripe_customer_id,
    payment_rail: row.payment_rail ?? undefined,
    manual_payment_approved_at: row.manual_payment_approved_at,
    manual_payment_approved_by: row.manual_payment_approved_by,
  });
}

function normalizeInvoiceStatus(status: string | null): string {
  return status?.trim().toLowerCase() || "none";
}

function collapseJobberJobs(
  rows: BusinessPulseJobRow[],
  memberPropertyIds: Set<string>,
): BusinessPulseRecentJob[] {
  const grouped = new Map<string, BusinessPulseRecentJob>();
  for (const row of rows) {
    const amountCents = Math.max(0, Number(row.job_total_cents ?? 0));
    const invoiceStatus = normalizeInvoiceStatus(row.visit_invoice_status);
    const memberAssociated = Boolean(
      row.external_property_id && memberPropertyIds.has(row.external_property_id),
    );
    const current = grouped.get(row.external_job_id);
    if (!current) {
      grouped.set(row.external_job_id, {
        externalJobId: row.external_job_id,
        jobNumber: row.job_number,
        customerName: row.client_name?.trim() || "Unknown customer",
        title: row.title?.trim() || "Jobber service",
        serviceAt: row.scheduled_start,
        amountCents,
        invoiceStatus,
        completed: row.is_complete,
        membershipAssociated: memberAssociated,
      });
      continue;
    }
    current.amountCents = Math.max(current.amountCents, amountCents);
    current.completed ||= row.is_complete;
    current.membershipAssociated ||= memberAssociated;
    if (invoiceStatus === "paid" || current.invoiceStatus === "none") {
      current.invoiceStatus = invoiceStatus;
    }
    if (row.scheduled_start < current.serviceAt) {
      current.serviceAt = row.scheduled_start;
    }
  }
  return [...grouped.values()].sort((a, b) =>
    b.serviceAt.localeCompare(a.serviceAt),
  );
}

function yearOverYearComparison(input: {
  currentValueCents: number;
  priorValueCents: number | null;
  priorYear: number;
  comparisonKind: "full_month" | "month_to_date";
  throughDay: number | null;
}): BusinessPulseYearOverYearComparison {
  if (input.priorValueCents === null) {
    return {
      priorYear: input.priorYear,
      priorValueCents: null,
      percentChange: null,
      status: "unavailable",
      comparisonKind: input.comparisonKind,
      throughDay: input.throughDay,
    };
  }
  if (input.priorValueCents === 0) {
    return {
      priorYear: input.priorYear,
      priorValueCents: 0,
      percentChange: input.currentValueCents === 0 ? 0 : null,
      status: input.currentValueCents === 0 ? "flat" : "new",
      comparisonKind: input.comparisonKind,
      throughDay: input.throughDay,
    };
  }
  const percentChange =
    ((input.currentValueCents - input.priorValueCents) /
      input.priorValueCents) *
    100;
  return {
    priorYear: input.priorYear,
    priorValueCents: input.priorValueCents,
    percentChange: Math.round(percentChange * 10) / 10,
    status: percentChange > 0 ? "up" : percentChange < 0 ? "down" : "flat",
    comparisonKind: input.comparisonKind,
    throughDay: input.throughDay,
  };
}

export function buildMonthlyBusinessPerformance(input: {
  jobs: BusinessPulseMonthlyJobRow[];
  memberships: BusinessPulseMembershipRow[];
  agreements: BusinessPulseAgreementRow[];
  reference?: Date;
}): BusinessPulseSnapshot["monthlyRevenue"] {
  const reference = input.reference ?? new Date();
  const currentMonthKey = formatBusinessCalendarDate(reference).slice(0, 7);
  const currentYear = Number(currentMonthKey.slice(0, 4));
  const currentDay = Number(formatBusinessCalendarDate(reference).slice(8, 10));
  const jobs = new Map<
    string,
    { serviceAt: string; amountCents: number; paid: boolean; day: number }
  >();

  for (const row of input.jobs) {
    if (!row.scheduled_start) continue;
    const amountCents = Math.max(0, Number(row.job_total_cents ?? 0));
    const paid = normalizeInvoiceStatus(row.visit_invoice_status) === "paid";
    const instant = new Date(row.scheduled_start);
    if (Number.isNaN(instant.getTime())) continue;
    const day = Number(formatBusinessCalendarDate(instant).slice(8, 10));
    const existing = jobs.get(row.external_job_id);
    if (!existing) {
      jobs.set(row.external_job_id, {
        serviceAt: row.scheduled_start,
        amountCents,
        paid,
        day,
      });
      continue;
    }
    existing.amountCents = Math.max(existing.amountCents, amountCents);
    existing.paid ||= paid;
    if (row.scheduled_start < existing.serviceAt) {
      existing.serviceAt = row.scheduled_start;
      existing.day = day;
    }
  }

  const historicalJobs = [...jobs.values()].flatMap((job) => {
    const instant = new Date(job.serviceAt);
    if (Number.isNaN(instant.getTime())) return [];
    const monthKey = formatBusinessCalendarDate(instant).slice(0, 7);
    const year = Number(monthKey.slice(0, 4));
    if (
      !Number.isFinite(year) ||
      monthKey > currentMonthKey ||
      (monthKey === currentMonthKey && job.day > currentDay)
    ) {
      return [];
    }
    return [{ ...job, monthKey, year }];
  });
  const paidJobs = historicalJobs.filter((job) => job.paid);
  const earliestRecordedMonth =
    historicalJobs
      .map((job) => job.monthKey)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;
  const membershipsById = new Map(
    input.memberships.map((membership) => [membership.id, membership]),
  );
  const recordedMemberships = new Set<string>();
  const signedMemberships = input.agreements.flatMap((agreement) => {
    if (!agreement.membership_id || recordedMemberships.has(agreement.membership_id)) {
      return [];
    }
    const membership = membershipsById.get(agreement.membership_id);
    if (!membership || membership.agreement_id !== agreement.id) return [];
    const instant = new Date(agreement.signed_at);
    if (Number.isNaN(instant.getTime())) return [];
    const calendarDate = formatBusinessCalendarDate(instant);
    const monthKey = calendarDate.slice(0, 7);
    if (
      monthKey > currentMonthKey ||
      (monthKey === currentMonthKey &&
        Number(calendarDate.slice(8, 10)) > currentDay)
    ) {
      return [];
    }
    recordedMemberships.add(agreement.membership_id);
    return [
      {
        membershipId: agreement.membership_id,
        monthKey,
        year: Number(monthKey.slice(0, 4)),
        day: Number(calendarDate.slice(8, 10)),
        arrAddedCents: yearlyValueCents(membership),
      },
    ];
  });
  const earliestArrMonth =
    signedMemberships
      .map((membership) => membership.monthKey)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;
  const earliestYear = [...historicalJobs, ...signedMemberships].reduce(
    (earliest, record) => Math.min(earliest, record.year),
    currentYear,
  );
  const years = Array.from(
    { length: currentYear - earliestYear + 1 },
    (_, index) => earliestYear + index,
  );
  const points = years.flatMap((year) =>
    MONTH_LABELS.map((monthLabel, index) => ({
      year,
      month: index + 1,
      monthKey: `${year}-${String(index + 1).padStart(2, "0")}`,
      monthLabel,
      paidRevenueCents: 0,
      paidJobs: 0,
      arrAddedCents: 0,
      membershipsSold: 0,
      hasSourceCoverage: Boolean(
        earliestRecordedMonth &&
          `${year}-${String(index + 1).padStart(2, "0")}` >=
            earliestRecordedMonth,
      ),
      hasArrCoverage: Boolean(
        earliestArrMonth &&
          `${year}-${String(index + 1).padStart(2, "0")}` >= earliestArrMonth,
      ),
      isFutureMonth:
        `${year}-${String(index + 1).padStart(2, "0")}` > currentMonthKey,
      revenueYearOverYear: yearOverYearComparison({
        currentValueCents: 0,
        priorValueCents: null,
        priorYear: year - 1,
        comparisonKind: "full_month",
        throughDay: null,
      }),
      arrYearOverYear: yearOverYearComparison({
        currentValueCents: 0,
        priorValueCents: null,
        priorYear: year - 1,
        comparisonKind: "full_month",
        throughDay: null,
      }),
    })),
  );
  const pointsByKey = new Map(points.map((point) => [point.monthKey, point]));
  for (const job of paidJobs) {
    const point = pointsByKey.get(job.monthKey);
    if (!point) continue;
    point.paidRevenueCents += job.amountCents;
    point.paidJobs += 1;
  }
  for (const membership of signedMemberships) {
    const point = pointsByKey.get(membership.monthKey);
    if (!point) continue;
    point.arrAddedCents += membership.arrAddedCents;
    point.membershipsSold += 1;
  }

  for (const point of points) {
    if (point.isFutureMonth) continue;
    const priorMonthKey = `${point.year - 1}-${String(point.month).padStart(2, "0")}`;
    const priorPoint = pointsByKey.get(priorMonthKey);
    const isCurrentMonth = point.monthKey === currentMonthKey;
    const comparisonKind = isCurrentMonth ? "month_to_date" : "full_month";
    const throughDay = isCurrentMonth ? currentDay : null;
    const comparablePriorRevenue = priorPoint?.hasSourceCoverage
      ? paidJobs
          .filter(
            (job) =>
              job.monthKey === priorMonthKey &&
              (!isCurrentMonth || job.day <= currentDay),
          )
          .reduce((sum, job) => sum + job.amountCents, 0)
      : null;
    const comparablePriorArr = priorPoint?.hasArrCoverage
      ? signedMemberships
          .filter(
            (membership) =>
              membership.monthKey === priorMonthKey &&
              (!isCurrentMonth || membership.day <= currentDay),
          )
          .reduce((sum, membership) => sum + membership.arrAddedCents, 0)
      : null;
    point.revenueYearOverYear = yearOverYearComparison({
      currentValueCents: point.paidRevenueCents,
      priorValueCents: comparablePriorRevenue,
      priorYear: point.year - 1,
      comparisonKind,
      throughDay,
    });
    point.arrYearOverYear = yearOverYearComparison({
      currentValueCents: point.arrAddedCents,
      priorValueCents: comparablePriorArr,
      priorYear: point.year - 1,
      comparisonKind,
      throughDay,
    });
  }

  return {
    currentYear,
    years,
    points,
    earliestRecordedMonth,
    earliestArrMonth,
  };
}

export function buildMonthlyPaidRevenue(
  rows: BusinessPulseMonthlyJobRow[],
  reference: Date = new Date(),
): BusinessPulseSnapshot["monthlyRevenue"] {
  return buildMonthlyBusinessPerformance({
    jobs: rows,
    memberships: [],
    agreements: [],
    reference,
  });
}

export function buildBusinessPulseSnapshot(input: {
  range: BusinessPulseRange;
  now?: Date;
  jobs: BusinessPulseJobRow[];
  historicalJobs?: BusinessPulseMonthlyJobRow[];
  memberships: BusinessPulseMembershipRow[];
  agreements: BusinessPulseAgreementRow[];
  propertyLinks: BusinessPulsePropertyLinkRow[];
  billingCharges: BusinessPulseBillingChargeRow[];
  addons: BusinessPulseAddonRow[];
  leads: BusinessPulseLeadRow[];
  jobberConnectionStatus: string | null;
  jobberLastSyncedAt: string | null;
  stripeConfigured: boolean;
  stripeLastEventAt: string | null;
  stripeProcessingErrors: number;
  goHighLevelConfigured: boolean;
  warnings?: string[];
}): BusinessPulseSnapshot {
  const now = input.now ?? new Date();
  const onBookMemberships = input.memberships.filter(
    (row) => Boolean(row.agreement_id) && !isCancelled(row.status),
  );
  const activeMemberships = input.memberships.filter(isActiveMembership);
  const onBookMembershipIds = new Set(onBookMemberships.map((row) => row.id));
  const linkedExternalPropertyIds = new Set(
    input.propertyLinks
      .filter(
        (link) =>
          link.link_state === "active" && onBookMembershipIds.has(link.membership_id),
      )
      .map((link) => link.external_property_id),
  );
  const jobs = collapseJobberJobs(input.jobs, linkedExternalPropertyIds);
  const paidJobs = jobs.filter((job) => job.invoiceStatus === "paid");
  const completedJobs = jobs.filter((job) => job.completed);
  const classifiedJobs = jobs.filter((job) => job.membershipAssociated).length;
  const unclassifiedJobs = jobs.length - classifiedJobs;
  const membershipsById = new Map(
    input.memberships.map((membership) => [membership.id, membership]),
  );
  const recordedMembershipIds = new Set<string>();
  const allMembershipSales = input.agreements
    .flatMap((agreement) => {
      if (!agreement.membership_id || recordedMembershipIds.has(agreement.membership_id)) {
        return [];
      }
      const membership = membershipsById.get(agreement.membership_id);
      if (!membership || membership.agreement_id !== agreement.id) return [];
      recordedMembershipIds.add(agreement.membership_id);
      return [
        {
          membershipId: membership.id,
          customerName: agreement.homeowner_name || "Unknown customer",
          signedAt: agreement.signed_at,
          annualizedValueCents: yearlyValueCents(membership),
        },
      ];
    })
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  const recentMembershipSales = allMembershipSales.filter(
    (sale) =>
      sale.signedAt >= input.range.startUtc && sale.signedAt < input.range.endUtc,
  );

  const paidWorkValueCents = paidJobs.reduce(
    (sum, job) => sum + job.amountCents,
    0,
  );
  const membershipPaidWorkValueCents = paidJobs
    .filter((job) => job.membershipAssociated)
    .reduce((sum, job) => sum + job.amountCents, 0);
  const billingCollectedCents = input.billingCharges
    .filter((charge) => ["paid", "charged"].includes(charge.status))
    .reduce(
      (sum, charge) =>
        sum + Math.round(Number(charge.amount_collected ?? charge.amount ?? 0) * 100),
      0,
    );
  const addonCollectedCents = input.addons
    .filter((addon) => ["paid", "completed", "charged"].includes(addon.status))
    .reduce((sum, addon) => sum + Number(addon.amount_charged_cents ?? 0), 0);
  const leadCounts = new Map<string, number>();
  for (const lead of input.leads) {
    const source = lead.source?.trim() || "unknown";
    leadCounts.set(source, (leadCounts.get(source) ?? 0) + 1);
  }
  const leadMix = [...leadCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const nowIso = now.toISOString();
  const warnings = [...(input.warnings ?? [])];
  if (unclassifiedJobs > 0) {
    warnings.push(
      `${unclassifiedJobs} of ${jobs.length} Jobber jobs in this period are not linked to a HomeAtlas membership property, so their member versus one-time split remains unclassified.`,
    );
  }
  if (paidJobs.some((job) => job.amountCents === 0)) {
    warnings.push(
      "At least one Jobber-paid job has no stored total and is excluded from dollar totals.",
    );
  }

  return {
    generatedAt: nowIso,
    source: "supabase",
    range: input.range,
    metrics: {
      paidWorkValueCents,
      completedWorkValueCents: completedJobs.reduce(
        (sum, job) => sum + job.amountCents,
        0,
      ),
      bookedWorkValueCents: jobs.reduce((sum, job) => sum + job.amountCents, 0),
      membershipPaidWorkValueCents,
      unclassifiedPaidWorkValueCents:
        paidWorkValueCents - membershipPaidWorkValueCents,
      homeAtlasMembershipCollectedCents:
        billingCollectedCents + addonCollectedCents,
      activeArrCents: activeMemberships.reduce(
        (sum, membership) => sum + yearlyValueCents(membership),
        0,
      ),
      arrAddedCents: recentMembershipSales.reduce(
        (sum, sale) => sum + sale.annualizedValueCents,
        0,
      ),
      activeMembers: activeMemberships.length,
      membershipsSold: recentMembershipSales.length,
      leads: input.leads.length,
      jobsBooked: jobs.length,
      jobsCompleted: completedJobs.length,
      jobsMarkedPaid: paidJobs.length,
      classifiedJobs,
      unclassifiedJobs,
    },
    monthlyRevenue: buildMonthlyBusinessPerformance({
      jobs: input.historicalJobs ?? input.jobs,
      memberships: input.memberships,
      agreements: input.agreements,
      reference: now,
    }),
    leadMix,
    recentJobs: jobs.slice(0, 20),
    recentMembershipSales: recentMembershipSales.slice(0, 20),
    sources: {
      homeAtlas: {
        label: "HomeAtlas",
        status: "healthy",
        lastEventAt: nowIso,
        detail: "Memberships, agreements, leads, and billing ledgers loaded live.",
      },
      jobber: {
        label: "Jobber",
        status:
          input.jobberConnectionStatus === "connected" ? "healthy" : "attention",
        lastEventAt: input.jobberLastSyncedAt,
        detail:
          input.jobberConnectionStatus === "connected"
            ? "Connected; webhooks plus scheduled reconciliation feed operational totals."
            : "Connection needs attention before Jobber totals can be trusted.",
      },
      stripe: {
        label: "Stripe",
        status: !input.stripeConfigured
          ? "not_connected"
          : input.stripeProcessingErrors > 0
            ? "attention"
            : input.stripeLastEventAt
              ? "healthy"
              : "idle",
        lastEventAt: input.stripeLastEventAt,
        detail: !input.stripeConfigured
          ? "Stripe server integration is not configured."
          : input.stripeProcessingErrors > 0
            ? `${input.stripeProcessingErrors} webhook event${input.stripeProcessingErrors === 1 ? "" : "s"} need reconciliation.`
            : "Webhook ledger is available for HomeAtlas-controlled collections.",
      },
      goHighLevel: {
        label: "GoHighLevel",
        status: input.goHighLevelConfigured ? "idle" : "not_connected",
        lastEventAt: null,
        detail: input.goHighLevelConfigured
          ? "Credentials are present; attribution ingestion is ready for the next connector step."
          : "Optional attribution layer. HomeAtlas remains the customer source of truth.",
      },
    },
    warnings,
    definitions: [
      {
        label: "Paid work value",
        definition:
          "Unique Jobber jobs scheduled in the selected service period whose invoice is marked paid. It is not added to HomeAtlas collections.",
      },
      {
        label: "Monthly paid revenue",
        definition:
          "Unique Jobber jobs whose invoice is marked paid, grouped by the month the service was scheduled in Pacific business time. Current-month year-over-year compares month-to-date through the same calendar day; closed months compare the full month.",
      },
      {
        label: "Completed work",
        definition:
          "Stored Jobber job value for unique jobs marked complete in the selected service period, regardless of payment state.",
      },
      {
        label: "Booked work",
        definition:
          "Stored Jobber job value for unique jobs scheduled in the selected service period.",
      },
      {
        label: "HomeAtlas membership collected",
        definition:
          "Successful HomeAtlas membership and add-on ledger charges. Shown as a reconciliation subset, never added to Jobber revenue.",
      },
      {
        label: "ARR added",
        definition:
          "Gross annualized contract value credited once to the Pacific month its canonical membership agreement was signed. Later cancellation does not rewrite the historical sale; active ARR shows the current book.",
      },
    ],
  };
}

export function isBusinessPulsePeriod(value: string | null): value is BusinessPulsePeriod {
  return BUSINESS_PULSE_PERIODS.some((period) => period.value === value);
}
