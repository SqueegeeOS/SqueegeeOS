import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import type {
  BillingRegisterRow,
  BillingWorkspaceData,
} from "@/lib/admin/billing-workspace-types";
import { billingMembershipAnchorId } from "@/lib/admin/billing-workspace-links";
import type { ProductionHealthReport } from "@/lib/admin/production-health-types";
import type { OwnerLeverageSnapshot } from "@/lib/admin/owner-leverage";
import {
  customerAftercareTaskAnchorId,
  type CustomerAftercareSnapshot,
} from "@/lib/aftercare/customer-aftercare";
import {
  isJobberTodayDataStale,
  classifyJobberTodayVisit,
  type JobberTodayData,
  type JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import {
  jobberTodayVisitAnchorId,
  visitFieldFollowUpAnchorId,
} from "@/lib/care-operations/jobber-today-links";
import type { CommunicationsLaunchReadiness } from "@/lib/communications/integration-launch-readiness-core";
import { classifyVisitFieldFollowUp } from "@/lib/field-records/visit-field-record";
import type { TechnicianReadinessSnapshot } from "@/lib/field-operations/technician-readiness";
import type { TechnicianCapacitySnapshot } from "@/lib/field-operations/technician-capacity";
import { ROUTES } from "@/lib/navigation/config";
import {
  referralMemberAnchorId,
  type ReferralAttentionSnapshot,
} from "@/lib/referrals/attention-types";
import type {
  OwnerSalesAttentionSnapshot,
  OwnerSalesPipelineSnapshot,
} from "@/lib/sales/owner-pipeline";
import type { SalesRetentionAttentionSnapshot } from "@/lib/sales/attribution-lifecycle";
import type { SalesProductionHandoffRecord } from "@/lib/sales/production-handoff";
import {
  CUSTOMER_SERVICE_CASE_CATEGORY_LABELS,
  customerServiceCaseAnchorId,
} from "@/lib/service-cases/customer-service-case";

export type OwnerAttentionPriority = "critical" | "high" | "normal";
export type OwnerAttentionDomain =
  | "leads"
  | "sales"
  | "dispatch"
  | "field"
  | "billing"
  | "communications"
  | "growth"
  | "systems";
export type OwnerAttentionSourceState = "ready" | "degraded";
export type OwnerAttentionSourceId =
  | "owner_sales"
  | "sales_retention"
  | "today"
  | "owner_leverage"
  | "technician_readiness"
  | "technician_capacity"
  | "billing"
  | "communications"
  | "aftercare"
  | "referrals"
  | "production_health";

export interface OwnerAttentionItem {
  id: string;
  priority: OwnerAttentionPriority;
  domain: OwnerAttentionDomain;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  sourceLabel: string;
  affectedCount: number;
  observedAt: string | null;
  dueAt: string | null;
}

export interface OwnerAttentionSourceStatus {
  id: OwnerAttentionSourceId;
  label: string;
  state: OwnerAttentionSourceState;
  detail: string;
}

export interface OwnerAttentionResponse {
  generatedAt: string;
  summary: {
    actionCount: number;
    itemCount: number;
    criticalCount: number;
    highCount: number;
    normalCount: number;
    degradedSourceCount: number;
  };
  items: OwnerAttentionItem[];
  sources: OwnerAttentionSourceStatus[];
}

export type OwnerAttentionSourceResult<T> =
  | { state: "ready"; data: T }
  | { state: "degraded"; detail: string };

export interface OwnerAttentionInput {
  now: Date;
  ownerSales: OwnerAttentionSourceResult<OwnerSalesAttentionSnapshot>;
  salesRetention: OwnerAttentionSourceResult<SalesRetentionAttentionSnapshot>;
  today: OwnerAttentionSourceResult<JobberTodayData>;
  ownerLeverage: OwnerAttentionSourceResult<OwnerLeverageSnapshot>;
  technicianReadiness: OwnerAttentionSourceResult<TechnicianReadinessSnapshot>;
  technicianCapacity: OwnerAttentionSourceResult<TechnicianCapacitySnapshot>;
  billing: OwnerAttentionSourceResult<BillingWorkspaceData>;
  communications: OwnerAttentionSourceResult<CommunicationsLaunchReadiness>;
  aftercare: OwnerAttentionSourceResult<CustomerAftercareSnapshot>;
  referrals: OwnerAttentionSourceResult<ReferralAttentionSnapshot>;
  productionHealth: OwnerAttentionSourceResult<ProductionHealthReport>;
}

const PRIORITY_ORDER: Record<OwnerAttentionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

const SOURCE_DEFINITIONS: Array<{
  id: OwnerAttentionSourceId;
  label: string;
  domain: OwnerAttentionDomain;
  href: string;
  priority: OwnerAttentionPriority;
}> = [
  {
    id: "owner_sales",
    label: "Owner + field sales",
    domain: "sales",
    href: ROUTES.hqSales,
    priority: "high",
  },
  {
    id: "sales_retention",
    label: "Sales retention ledger",
    domain: "sales",
    href: "/david",
    priority: "critical",
  },
  {
    id: "today",
    label: "Today & field proof",
    domain: "dispatch",
    href: ROUTES.hqToday,
    priority: "critical",
  },
  {
    id: "owner_leverage",
    label: "Owner leverage ledger",
    domain: "growth",
    href: ROUTES.hqGrowth,
    priority: "high",
  },
  {
    id: "technician_readiness",
    label: "Technician readiness",
    domain: "field",
    href: ROUTES.hqTechnicians,
    priority: "high",
  },
  {
    id: "technician_capacity",
    label: "Technician capacity runway",
    domain: "field",
    href: ROUTES.hqTechnicians,
    priority: "high",
  },
  {
    id: "billing",
    label: "Billing register",
    domain: "billing",
    href: ROUTES.hqBilling,
    priority: "critical",
  },
  {
    id: "communications",
    label: "Communications readiness",
    domain: "communications",
    href: ROUTES.hqCommunications,
    priority: "high",
  },
  {
    id: "aftercare",
    label: "Customer aftercare",
    domain: "growth",
    href: ROUTES.hqAftercare,
    priority: "high",
  },
  {
    id: "referrals",
    label: "Referral rewards",
    domain: "growth",
    href: "/hq/referrals",
    priority: "high",
  },
  {
    id: "production_health",
    label: "Production safeguards",
    domain: "systems",
    href: ROUTES.hqProductionHealth,
    priority: "high",
  },
];

const HEALTH_CHECKS_COVERED_BY_OPERATIONAL_SOURCES = new Set([
  "jobber-oauth-config",
  "jobber-connection",
  "email-provider",
  "resend-webhook",
  "sms-provider",
  "twilio-webhook",
  "meta-lead-ads",
  "automation-scheduler",
  "billing-webhook",
  "automatic-billing",
  "billing-exceptions",
]);

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue;
}

function formatWaiting(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "hour")}`;
  const days = Math.floor(hours / 24);
  return `${days} ${plural(days, "day")}`;
}

function formatArr(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);
}

function formatDollars(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatCapacityHours(minutes: number): string {
  const value = Math.abs(minutes) / 60;
  return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}h`;
}

function firstUsefulLeadContext(lead: LeadIntakeRecord): string {
  const service = lead.servicesInterested[0];
  return [
    lead.source === "facebook_lead_ad"
      ? "Facebook lead"
      : lead.source === "technician_referral"
        ? `Technician referral${lead.referredByTechnicianName ? ` · ${lead.referredByTechnicianName}` : ""}`
        : "Website request",
    service || null,
    lead.serviceAddress || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function addCustomerLeadItems(
  items: OwnerAttentionItem[],
  leads: LeadIntakeRecord[],
  now: Date,
) {
  const newLeads = leads
    .filter((lead) => lead.status === "new")
    .sort(
      (left, right) =>
        (timestamp(left.submittedAt) ?? Number.MAX_SAFE_INTEGER) -
        (timestamp(right.submittedAt) ?? Number.MAX_SAFE_INTEGER),
    );
  const visible = newLeads.slice(0, 5);

  for (const lead of visible) {
    const submittedAt = timestamp(lead.submittedAt);
    const waitingMs = submittedAt === null ? 0 : now.getTime() - submittedAt;
    items.push({
      id: `lead:${lead.id}`,
      priority: waitingMs >= 4 * 60 * 60 * 1_000 ? "critical" : "high",
      domain: "leads",
      title: `Reply to ${lead.name}`,
      detail: `${firstUsefulLeadContext(lead)}. Waiting ${formatWaiting(waitingMs)}.`,
      href: `${ROUTES.hqPendingRequests}/${encodeURIComponent(lead.id)}`,
      actionLabel: "Open lead",
      sourceLabel: "Website & Facebook leads",
      affectedCount: 1,
      observedAt: lead.submittedAt,
      dueAt: lead.submittedAt,
    });
  }

  const overflow = newLeads.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "lead:overflow",
      priority: "high",
      domain: "leads",
      title: `${overflow} more new ${plural(overflow, "lead")} need replies`,
      detail: "Open the request inbox and work the remaining uncontacted leads oldest first.",
      href: ROUTES.hqPendingRequests,
      actionLabel: "Open requests",
      sourceLabel: "Website & Facebook leads",
      affectedCount: overflow,
      observedAt: null,
      dueAt: null,
    });
  }
}

function addOwnerSalesPipelineItems(
  items: OwnerAttentionItem[],
  snapshot: OwnerSalesPipelineSnapshot,
  now: Date,
) {
  const queue = snapshot.leads.filter(
    (lead) => lead.actionMoment !== "upcoming",
  );
  const visible = queue.slice(0, 5);

  for (const lead of visible) {
    const followUpAt = timestamp(lead.nextFollowUpAt);
    const overdueMs = followUpAt === null ? 0 : now.getTime() - followUpAt;
    const priority: OwnerAttentionPriority =
      lead.actionMoment === "overdue" && overdueMs >= 24 * 60 * 60 * 1_000
        ? "critical"
        : lead.actionMoment === "unscheduled"
          ? "normal"
          : "high";
    const timing =
      lead.actionMoment === "overdue"
        ? `Follow-up overdue by ${formatWaiting(overdueMs)}`
        : lead.actionMoment === "due_today"
          ? "Follow-up is due today"
          : "No next check-in is scheduled";
    items.push({
      id: `sales-lead:${lead.id}`,
      priority,
      domain: "sales",
      title: `${lead.repDisplayName}: ${lead.fullName}`,
      detail: `${timing} · ${formatArr(lead.estimatedArrCents)} potential ARR · ${lead.status.replaceAll("_", " ")}.`,
      href: `${ROUTES.hqSales}#owner-sales-lead-${lead.id}`,
      actionLabel: "Open pipeline",
      sourceLabel: `${lead.repDisplayName} pipeline`,
      affectedCount: 1,
      observedAt: lead.updatedAt,
      dueAt: lead.nextFollowUpAt,
    });
  }

  const overflow = queue.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "sales-lead:overflow",
      priority: "normal",
      domain: "sales",
      title: `${overflow} more owned pipeline ${plural(overflow, "action")}`,
      detail:
        "Open the owner sales desk to schedule or complete the remaining rep check-ins.",
      href: ROUTES.hqSales,
      actionLabel: "Open pipeline",
      sourceLabel: "Owner + field sales",
      affectedCount: overflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addSalesRetentionItems(
  items: OwnerAttentionItem[],
  snapshot: SalesRetentionAttentionSnapshot,
  now: Date,
) {
  if (snapshot.truncated) {
    items.push({
      id: "sales-retention:coverage",
      priority: "high",
      domain: "systems",
      title: "Sales retention view reached its coverage limit",
      detail: "Atlas found more than 500 open retention records. Treat this queue as partial until the ledger is paginated or narrowed.",
      href: "/david",
      actionLabel: "Open David workspace",
      sourceLabel: "Sales retention ledger",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
  const cancelledStatuses = new Set(["cancelled", "archived", "inactive"]);
  const ordered = [...snapshot.records].sort((left, right) => {
    const leftCancelled = cancelledStatuses.has(left.membershipStatus);
    const rightCancelled = cancelledStatuses.has(right.membershipStatus);
    if (leftCancelled !== rightCancelled) return leftCancelled ? -1 : 1;
    return left.retentionQualifiesAt.localeCompare(right.retentionQualifiesAt);
  });
  const visible = ordered.slice(0, 5);
  for (const record of visible) {
    const cancelled = cancelledStatuses.has(record.membershipStatus);
    const dueAt = timestamp(record.retentionQualifiesAt);
    const overdueMs = dueAt === null ? 0 : now.getTime() - dueAt;
    const priority: OwnerAttentionPriority = cancelled
      ? "critical"
      : overdueMs >= 36 * 60 * 60 * 1_000
        ? "critical"
        : "high";
    items.push({
      id: `sales-retention:${record.attributionId}`,
      priority,
      domain: "sales",
      title: cancelled
        ? `Reconcile ${record.repDisplayName} credit for ${record.homeownerName}`
        : `${record.homeownerName} reached the retention checkpoint`,
      detail: cancelled
        ? `The membership is ${record.membershipStatus}, but its sales attribution is still ${record.qualificationStatus}. The daily lifecycle writer has not caught up.`
        : `${record.repDisplayName}’s attribution is still ${record.qualificationStatus} ${formatWaiting(overdueMs)} after its retention date. Verify membership health before changing compensation state.`,
      href: ROUTES.hqCustomerWorkspace("membership", record.membershipId),
      actionLabel: "Open member record",
      sourceLabel: "Sales retention ledger",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: record.retentionQualifiesAt,
    });
  }
  const overflow = ordered.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "sales-retention:overflow",
      priority: "high",
      domain: "sales",
      title: `${overflow} more sales retention ${plural(overflow, "exception")}`,
      detail: "Review the remaining retained-member attribution records before treating commissions or milestones as final.",
      href: "/david",
      actionLabel: "Open David workspace",
      sourceLabel: "Sales retention ledger",
      affectedCount: overflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addSalesProductionHandoffItems(
  items: OwnerAttentionItem[],
  snapshot: {
    generatedAt: string;
    records: SalesProductionHandoffRecord[];
  },
) {
  const unknown = snapshot.records.filter(
    (record) => record.stage === "source_unavailable",
  );
  if (unknown.length > 0) {
    items.push({
      id: "sales-handoff:schedule-source",
      priority: "high",
      domain: "systems",
      title: `Verify Jobber schedule truth for ${unknown.length} signed ${plural(unknown.length, "member")}`,
      detail:
        "Their membership, property, and recurring-job links exist, but current Jobber data is unavailable. Atlas is not calling them unscheduled.",
      href: ROUTES.hqJobber,
      actionLabel: "Restore Jobber truth",
      sourceLabel: "Signed-to-scheduled handoffs",
      affectedCount: unknown.length,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  const actionable = snapshot.records.filter(
    (record) =>
      record.stage !== "ready" &&
      record.stage !== "payment_pending" &&
      record.stage !== "source_unavailable",
  );
  const visible = actionable.slice(0, 5);
  for (const record of visible) {
    const priority: OwnerAttentionPriority =
      record.stage === "payment_needed" ||
      record.stage === "membership_attention"
        ? "critical"
        : "high";
    items.push({
      id: `sales-handoff:${record.attributionId}`,
      priority,
      domain:
        record.stage === "payment_needed"
          ? "billing"
          : record.stage === "schedule_needed"
            ? "dispatch"
            : "sales",
      title: `${record.homeownerName}: ${record.label}`,
      detail: `${record.detail} ${record.completedSteps} of ${record.totalSteps} handoff proofs are complete.`,
      href: record.actionHref,
      actionLabel: record.actionLabel,
      sourceLabel: "Signed-to-scheduled handoffs",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: record.attributedAt,
    });
  }

  const overflow = actionable.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "sales-handoff:overflow",
      priority: "high",
      domain: "sales",
      title: `${overflow} more signed ${plural(overflow, "member")} need production handoff`,
      detail:
        "Open the owner sales desk and work the remaining payment, pairing, job-link, and scheduling steps.",
      href: `${ROUTES.hqSales}#signed-to-scheduled`,
      actionLabel: "Open handoff desk",
      sourceLabel: "Signed-to-scheduled handoffs",
      affectedCount: overflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addOwnerSalesAttentionItems(
  items: OwnerAttentionItem[],
  snapshot: OwnerSalesAttentionSnapshot,
  now: Date,
) {
  const pipeline = snapshot.pipeline;

  if (
    snapshot.unassignedInbound === null ||
    pipeline.inbound.status === "unavailable"
  ) {
    items.push({
      id: "owner-sales:inbound-unknown",
      priority: "high",
      domain: "systems",
      title: "Unassigned lead ownership cannot be verified",
      detail:
        "The owned sales queue is available, but HomeAtlas could not prove which website or Facebook requests still need an owner. Treat this as unknown, not clear.",
      href: ROUTES.hqSales,
      actionLabel: "Open sales desk",
      sourceLabel: "Owner + field sales",
      affectedCount: 1,
      observedAt: pipeline.generatedAt,
      dueAt: null,
    });
  } else {
    addCustomerLeadItems(items, snapshot.unassignedInbound, now);
  }

  addOwnerSalesPipelineItems(items, pipeline, now);

  if (pipeline.handoffs.status === "unavailable") {
    items.push({
      id: "owner-sales:handoffs-unknown",
      priority: "high",
      domain: "systems",
      title: "Signed-to-scheduled handoffs cannot be verified",
      detail:
        "HomeAtlas can still show owned lead actions, but it could not prove whether every signed customer reached payment, pairing, and Jobber scheduling.",
      href: `${ROUTES.hqSales}#signed-to-scheduled`,
      actionLabel: "Open handoff desk",
      sourceLabel: "Owner + field sales",
      affectedCount: 1,
      observedAt: pipeline.generatedAt,
      dueAt: null,
    });
  } else {
    addSalesProductionHandoffItems(items, pipeline.handoffs);
  }
}

function visitHref(visit: JobberTodayVisit): string {
  return `${ROUTES.hqToday}#${jobberTodayVisitAnchorId(visit.projectionId)}`;
}

function addVisitGroup(input: {
  items: OwnerAttentionItem[];
  id: string;
  visits: JobberTodayVisit[];
  priority: OwnerAttentionPriority;
  title: (count: number) => string;
  detail: string;
  actionLabel: string;
  observedAt: string;
}) {
  if (input.visits.length === 0) return;
  input.items.push({
    id: input.id,
    priority: input.priority,
    domain: "dispatch",
    title: input.title(input.visits.length),
    detail: input.detail,
    href: visitHref(input.visits[0]),
    actionLabel: input.actionLabel,
    sourceLabel: "Today & field proof",
    affectedCount: input.visits.length,
    observedAt: input.observedAt,
    dueAt: input.visits[0].scheduledStart,
  });
}

function addTodayItems(
  items: OwnerAttentionItem[],
  today: JobberTodayData,
  now: Date,
) {
  if (!today.connected) {
    items.push({
      id: "today:jobber-disconnected",
      priority: "critical",
      domain: "systems",
      title: "Reconnect Jobber before dispatch changes",
      detail: `The Today board is showing stored data because Jobber is ${today.connectionStatus.replaceAll("_", " ")}.`,
      href: ROUTES.hqJobber,
      actionLabel: "Reconnect Jobber",
      sourceLabel: "Today & field proof",
      affectedCount: 1,
      observedAt: today.lastSyncedAt,
      dueAt: null,
    });
  } else if (isJobberTodayDataStale(today.lastSyncedAt, now)) {
    items.push({
      id: "today:jobber-stale",
      priority: "high",
      domain: "dispatch",
      title: "Refresh today’s Jobber route",
      detail: "The stored schedule is more than six hours old. Sync it before dispatching or promising arrival times.",
      href: ROUTES.hqToday,
      actionLabel: "Open Today",
      sourceLabel: "Today & field proof",
      affectedCount: Math.max(1, today.summary.total),
      observedAt: today.lastSyncedAt,
      dueAt: null,
    });
  }

  if (!today.fieldRecordStatusAvailable) {
    items.push({
      id: "today:field-record-schema",
      priority: "high",
      domain: "systems",
      title: "Field proof is not verifiable",
      detail: "Today cannot verify visit notes, customer-visible updates, or open field follow-ups until the field-record schema is available.",
      href: ROUTES.hqProductionHealth,
      actionLabel: "Open production health",
      sourceLabel: "Today & field proof",
      affectedCount: 1,
      observedAt: today.loadedAt,
      dueAt: null,
    });
  }
  if (!today.fieldEventStatusAvailable) {
    items.push({
      id: "today:field-event-schema",
      priority: "normal",
      domain: "systems",
      title: "Technician stage events are not verifiable",
      detail: "Atlas cannot confirm en route, arrived, started, or departed events for today’s visits.",
      href: ROUTES.hqProductionHealth,
      actionLabel: "Open production health",
      sourceLabel: "Today & field proof",
      affectedCount: 1,
      observedAt: today.loadedAt,
      dueAt: null,
    });
  }

  const dueFollowUps = today.fieldFollowUps
    .filter((followUp) => {
      const moment = classifyVisitFieldFollowUp(followUp.dueAt, now);
      return moment === "overdue" || moment === "due_today";
    })
    .sort(
      (left, right) =>
        (timestamp(left.dueAt) ?? Number.MAX_SAFE_INTEGER) -
        (timestamp(right.dueAt) ?? Number.MAX_SAFE_INTEGER),
    );
  const visibleFollowUps = dueFollowUps.slice(0, 5);
  for (const followUp of visibleFollowUps) {
    const moment = classifyVisitFieldFollowUp(followUp.dueAt, now);
    items.push({
      id: `field-follow-up:${followUp.assessmentId}`,
      priority: moment === "overdue" ? "critical" : "high",
      domain: "field",
      title: `Follow up with ${followUp.homeownerName}`,
      detail: `${moment === "overdue" ? "Overdue" : "Due today"} · ${followUp.propertyAddress} · documented by ${followUp.technicianName}.`,
      href: `${ROUTES.hqToday}#${visitFieldFollowUpAnchorId(followUp.assessmentId)}`,
      actionLabel: "Open follow-up",
      sourceLabel: "Today & field proof",
      affectedCount: 1,
      observedAt: followUp.createdAt,
      dueAt: followUp.dueAt,
    });
  }
  const followUpOverflow = dueFollowUps.length - visibleFollowUps.length;
  if (followUpOverflow > 0) {
    items.push({
      id: "field-follow-up:overflow",
      priority: "high",
      domain: "field",
      title: `${followUpOverflow} more field ${plural(followUpOverflow, "follow-up")} due`,
      detail: "Work the remaining property follow-ups in due-time order.",
      href: ROUTES.hqToday,
      actionLabel: "Open Today",
      sourceLabel: "Today & field proof",
      affectedCount: followUpOverflow,
      observedAt: today.loadedAt,
      dueAt: null,
    });
  }

  const unpaired = today.visits.filter(
    (visit) => !visit.homeAtlasPropertyId || !visit.homeAtlasAppointmentId,
  );
  addVisitGroup({
    items,
    id: "today:unpaired",
    visits: unpaired,
    priority: "high",
    title: (count) => `${count} ${plural(count, "visit")} are not paired to HomeAtlas`,
    detail: "Pair the Jobber property and verified visit before relying on portal, proof, or billing automation.",
    actionLabel: "Open first visit",
    observedAt: today.loadedAt,
  });

  const unassigned = today.visits.filter(
    (visit) =>
      !visit.isComplete &&
      visit.assignmentReadState === "available" &&
      visit.assignedUsers.length === 0,
  );
  addVisitGroup({
    items,
    id: "today:unassigned",
    visits: unassigned,
    priority: "high",
    title: (count) => `${count} remaining ${plural(count, "visit")} have no technician`,
    detail: "Assign the route in Jobber before the service window begins.",
    actionLabel: "Open first visit",
    observedAt: today.loadedAt,
  });

  const departedButOpen = today.visits.filter(
    (visit) => !visit.isComplete && visit.homeAtlasFieldStage === "departed",
  );
  addVisitGroup({
    items,
    id: "today:departed-jobber-open",
    visits: departedButOpen,
    priority: "critical",
    title: (count) => `${count} departed ${plural(count, "visit")} still open in Jobber`,
    detail: "The crew recorded departure, but Jobber completion has not caught up. Review before invoicing or promising completion.",
    actionLabel: "Review first visit",
    observedAt: today.loadedAt,
  });

  const completedWithoutProof = today.visits.filter(
    (visit) => visit.isComplete && visit.homeAtlasFieldRecordCount === 0,
  );
  addVisitGroup({
    items,
    id: "today:completed-without-proof",
    visits: completedWithoutProof,
    priority: "high",
    title: (count) => `${count} completed ${plural(count, "visit")} need proof`,
    detail: "Add the visit note, completed scope, or photos so the property record and customer portal stay trustworthy.",
    actionLabel: "Document first visit",
    observedAt: today.loadedAt,
  });

  const privateOnly = today.visits.filter(
    (visit) =>
      visit.isComplete &&
      visit.homeAtlasFieldRecordCount > 0 &&
      visit.homeAtlasCustomerVisibleRecordCount === 0,
  );
  addVisitGroup({
    items,
    id: "today:private-only-proof",
    visits: privateOnly,
    priority: "normal",
    title: (count) => `${count} completed ${plural(count, "visit")} have no portal update`,
    detail: "The internal record exists, but the customer cannot see a visit note or photo yet.",
    actionLabel: "Review first visit",
    observedAt: today.loadedAt,
  });

  const late = today.visits.filter(
    (visit) =>
      !visit.isComplete &&
      visit.homeAtlasFieldStage !== "departed" &&
      classifyJobberTodayVisit(visit, now) === "late",
  );
  addVisitGroup({
    items,
    id: "today:late",
    visits: late,
    priority: "high",
    title: (count) => `${count} ${plural(count, "visit")} are past the service window`,
    detail: "Confirm crew status or update the customer before the route drifts further.",
    actionLabel: "Open first visit",
    observedAt: today.loadedAt,
  });
}

const STALE_GROWTH_SESSION_MS = 8 * 60 * 60 * 1_000;
const MAX_COUNTABLE_GROWTH_SESSION_MS = 16 * 60 * 60 * 1_000;

function addOwnerLeverageItems(
  items: OwnerAttentionItem[],
  snapshot: OwnerLeverageSnapshot,
  now: Date,
) {
  if (!snapshot.schemaAvailable) {
    items.push({
      id: "owner-leverage:schema",
      priority: "high",
      domain: "systems",
      title: "Owner leverage cannot be verified",
      detail:
        snapshot.warnings[0] ??
        "Apply the owner-leverage migration before using the buyback ladder.",
      href: ROUTES.hqProductionHealth,
      actionLabel: "Open production health",
      sourceLabel: "Owner leverage ledger",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
    return;
  }

  if (snapshot.unreviewedCompletedVisits > 0) {
    items.push({
      id: "owner-leverage:unreviewed-visits",
      priority: "high",
      domain: "field",
      title: `${snapshot.unreviewedCompletedVisits} completed ${plural(snapshot.unreviewedCompletedVisits, "visit")} await independence review`,
      detail:
        "Review the actual job class, technician, quality, and owner involvement. Unreviewed work adds zero bought-back time.",
      href: ROUTES.hqToday,
      actionLabel: "Review completed visits",
      sourceLabel: "Owner leverage ledger",
      affectedCount: snapshot.unreviewedCompletedVisits,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  const staleSessions = snapshot.openSessions
    .map((session) => ({
      session,
      ageMs: now.getTime() - (timestamp(session.startedAt) ?? now.getTime()),
    }))
    .filter(({ ageMs }) => ageMs >= STALE_GROWTH_SESSION_MS)
    .sort((left, right) => right.ageMs - left.ageMs);
  const visibleSessions = staleSessions.slice(0, 3);
  for (const { session, ageMs } of visibleSessions) {
    const overCountableLimit = ageMs >= MAX_COUNTABLE_GROWTH_SESSION_MS;
    items.push({
      id: `owner-leverage:open-session:${session.id}`,
      priority: overCountableLimit ? "critical" : "high",
      domain: "growth",
      title: `${session.operatorName}'s Growth Session is still open`,
      detail: overCountableLimit
        ? `The timer has run ${formatWaiting(ageMs)} and can no longer count. Cancel it so the ledger recovers without inventing Growth Hours.`
        : `The timer has run ${formatWaiting(ageMs)}. Finish it with exact break time or cancel it before the 16-hour counting limit.`,
      href: ROUTES.hqGrowth,
      actionLabel: overCountableLimit ? "Cancel stale session" : "Close Growth Session",
      sourceLabel: "Owner leverage ledger",
      affectedCount: 1,
      observedAt: session.startedAt,
      dueAt: new Date(
        new Date(session.startedAt).getTime() + STALE_GROWTH_SESSION_MS,
      ).toISOString(),
    });
  }
  const staleOverflow = staleSessions.length - visibleSessions.length;
  if (staleOverflow > 0) {
    items.push({
      id: "owner-leverage:open-session-overflow",
      priority: "high",
      domain: "growth",
      title: `${staleOverflow} more Growth ${plural(staleOverflow, "Session")} need closure`,
      detail:
        "Close or cancel every remaining timer before using Growth Hour productivity metrics.",
      href: ROUTES.hqGrowth,
      actionLabel: "Open Growth Hours",
      sourceLabel: "Owner leverage ledger",
      affectedCount: staleOverflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  if (
    snapshot.metrics.dedicatedGrowthDays > 0 &&
    snapshot.metrics.growthDayBand === "below_floor" &&
    snapshot.metrics.newArrPerDedicatedGrowthDay !== null
  ) {
    items.push({
      id: "owner-leverage:growth-day-below-floor",
      priority: "normal",
      domain: "growth",
      title: "Dedicated Growth Day finished below the ARR floor",
      detail: `${formatDollars(snapshot.metrics.newArrPerDedicatedGrowthDay)} signed ARR per qualifying Growth Day versus the $500 floor. Review the channel, offer, follow-up, and presentation conversion before adding spend.`,
      href: ROUTES.hqGrowth,
      actionLabel: "Review growth truth",
      sourceLabel: "Owner leverage ledger",
      affectedCount: snapshot.metrics.dedicatedGrowthDays,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addTechnicianReadinessItems(
  items: OwnerAttentionItem[],
  snapshot: TechnicianReadinessSnapshot,
) {
  const actionableOutcomes = new Set([
    "needs_schedule",
    "needs_review",
    "did_not_verify",
    "source_unavailable",
  ]);
  const actionableTrials = snapshot.trials
    .filter(
      (trial) =>
        trial.trialDate <= snapshot.today &&
        actionableOutcomes.has(trial.outcome),
    )
    .slice(0, 5);

  for (const trial of actionableTrials) {
    const copy =
      trial.outcome === "needs_schedule"
        ? "No assigned Jobber route is visible for the planned date. Assign a normal route or cancel the trial."
        : trial.outcome === "needs_review"
          ? `${trial.reviewedStops}/${trial.scheduledStops} assigned stops have an independence review. Complete every closeout before using the result.`
          : trial.outcome === "source_unavailable"
            ? "Jobber or assignment evidence is unavailable, so HomeAtlas refuses to score the day. Restore the source before making a staffing decision."
            : `${trial.qualifyingIndependentStops}/${trial.scheduledStops} assigned stops qualified. Review owner help, rework, safety, and service exceptions before the next trial.`;
    items.push({
      id: `technician-readiness:trial:${trial.id}`,
      priority:
        trial.outcome === "source_unavailable" ||
        trial.outcome === "did_not_verify"
          ? "critical"
          : "high",
      domain: "field",
      title: `${trial.displayName}'s independent-day trial needs review`,
      detail: copy,
      href: ROUTES.hqTechnicians,
      actionLabel: "Open readiness file",
      sourceLabel: "Technician readiness",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: `${trial.trialDate}T23:59:59`,
    });
  }

  const hasActiveOrVerifiedTrial = new Set(
    snapshot.trials
      .filter(
        (trial) =>
          (trial.status === "planned" && trial.trialDate >= snapshot.today) ||
          trial.outcome === "verified",
      )
      .map((trial) => trial.jobberUserId),
  );
  const readyToPlan = snapshot.technicians.filter(
    (technician) =>
      technician.mirroredRosterActive &&
      technician.evidenceCompleteForOwnerDecision &&
      !hasActiveOrVerifiedTrial.has(technician.jobberUserId),
  );
  if (readyToPlan.length > 0) {
    items.push({
      id: "technician-readiness:ready-to-plan",
      priority: "normal",
      domain: "field",
      title: `${readyToPlan.length} ${plural(readyToPlan.length, "technician")} ready for an owner decision`,
      detail:
        "Field Pass, all eight competencies, and at least one clean independent visit are evidenced. Noah can now decide whether to schedule a full normal trial day.",
      href: ROUTES.hqTechnicians,
      actionLabel: "Plan independent day",
      sourceLabel: "Technician readiness",
      affectedCount: readyToPlan.length,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addTechnicianCapacityItems(
  items: OwnerAttentionItem[],
  snapshot: TechnicianCapacitySnapshot,
) {
  const unavailableWeeks = snapshot.weeks.filter(
    (week) => !week.sourceAvailable,
  );
  if (unavailableWeeks.length > 0) {
    items.push({
      id: "technician-capacity:source-unavailable",
      priority: "high",
      domain: "field",
      title: `${unavailableWeeks.length} capacity ${plural(unavailableWeeks.length, "week")} cannot be verified`,
      detail:
        "Jobber connection, freshness, assignment, or duration evidence is incomplete. HomeAtlas is treating booked capacity as unknown, not empty.",
      href: ROUTES.hqTechnicians,
      actionLabel: "Restore capacity truth",
      sourceLabel: "Technician capacity runway",
      affectedCount: unavailableWeeks.length,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  const missingPlans = snapshot.technicians.filter(
    (technician) =>
      technician.mirroredRosterActive &&
      technician.weeks.some((week) => week.state === "no_plan"),
  );
  if (missingPlans.length > 0) {
    const names = missingPlans.slice(0, 4).map((technician) => technician.displayName);
    items.push({
      id: "technician-capacity:missing-plans",
      priority: "normal",
      domain: "field",
      title: `${missingPlans.length} ${plural(missingPlans.length, "technician")} need declared capacity`,
      detail: `${names.join(", ")}${missingPlans.length > names.length ? ", and more" : ""} have at least one undeclared week in the four-week runway. Add an owner planning assumption before treating open hours as real.`,
      href: ROUTES.hqTechnicians,
      actionLabel: "Declare capacity",
      sourceLabel: "Technician capacity runway",
      affectedCount: missingPlans.length,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  for (const [weekIndex, week] of snapshot.weeks.entries()) {
    if (
      week.sourceAvailable &&
      week.remainingCrewMinutes !== null &&
      week.remainingCrewMinutes < 0
    ) {
      const overloaded = snapshot.technicians
        .map((technician) => ({
          technician,
          week: technician.weeks.find(
            (forecast) => forecast.weekStart === week.weekStart,
          ),
        }))
        .filter(({ week: forecast }) => forecast?.overCapacity)
        .map(
          ({ technician, week: forecast }) =>
            `${technician.displayName} ${formatCapacityHours(forecast!.scheduledMinutes ?? 0)} booked / ${formatCapacityHours(forecast!.capacityMinutes ?? 0)} declared`,
        );
      items.push({
        id: `technician-capacity:over:${week.weekStart}`,
        priority: weekIndex <= 1 ? "critical" : "high",
        domain: "field",
        title: `${formatCapacityHours(week.remainingCrewMinutes)} over field capacity the week of ${week.weekStart}`,
        detail:
          overloaded.length > 0
            ? `${overloaded.join(" · ")}. Add or retrain production capacity instead of silently putting Noah back on the route.`
            : "Scheduled demand, including unassigned work, exceeds the field team's declared hours. Add or retrain production capacity instead of silently putting Noah back on the route.",
        href: ROUTES.hqTechnicians,
        actionLabel: "Resolve field capacity",
        sourceLabel: "Technician capacity runway",
        affectedCount: Math.max(1, overloaded.length),
        observedAt: snapshot.generatedAt,
        dueAt: `${week.weekStart}T08:00:00`,
      });
    }

    if (week.sourceAvailable && (week.unassignedStops ?? 0) > 0) {
      const count = week.unassignedStops ?? 0;
      items.push({
        id: `technician-capacity:unassigned:${week.weekStart}`,
        priority: "high",
        domain: "dispatch",
        title: `${count} scheduled ${plural(count, "stop")} unassigned the week of ${week.weekStart}`,
        detail: `${formatCapacityHours(week.unassignedMinutes ?? 0)} of visible work has no assigned Jobber technician. Assign field capacity before the route becomes an owner fallback.`,
        href: ROUTES.hqTechnicians,
        actionLabel: "Assign production",
        sourceLabel: "Technician capacity runway",
        affectedCount: count,
        observedAt: snapshot.generatedAt,
        dueAt: `${week.weekStart}T08:00:00`,
      });
    }
  }
}

function billingIssuePriority(row: BillingRegisterRow): OwnerAttentionPriority | null {
  if (
    row.billingExecutionState === "reconciliation_required" ||
    row.billingExecutionState === "permanently_failed"
  ) {
    return "critical";
  }
  if (
    row.billingStatus === "failed" ||
    row.billingExecutionState === "needs_action" ||
    row.billingExecutionState === "failed_retryable"
  ) {
    return "high";
  }
  return null;
}

function addBillingItems(
  items: OwnerAttentionItem[],
  billing: BillingWorkspaceData,
) {
  if (!billing.stripeDashboardLive && billing.rows.length > 0) {
    items.push({
      id: "billing:stripe-not-live",
      priority: "high",
      domain: "billing",
      title: "Stripe is not in live mode",
      detail: "Atlas can stage billing safely, but production collection cannot be trusted until live Stripe configuration is verified.",
      href: ROUTES.hqBilling,
      actionLabel: "Open Billing",
      sourceLabel: "Billing register",
      affectedCount: billing.rows.length,
      observedAt: billing.loadedAt,
      dueAt: null,
    });
  }

  const issueRows = billing.rows.filter((row) => billingIssuePriority(row));
  const visibleIssues = issueRows.slice(0, 5);
  for (const row of visibleIssues) {
    const execution = row.billingExecutionState?.replaceAll("_", " ");
    const failure = row.billingFailureCode
      ? ` · code ${row.billingFailureCode}`
      : "";
    items.push({
      id: `billing:${row.membershipId}`,
      priority: billingIssuePriority(row) ?? "high",
      domain: "billing",
      title: `Resolve billing for ${row.homeownerName}`,
      detail: `${execution ?? row.billingStatus.replaceAll("_", " ")}${failure}${row.billingAttemptCount > 0 ? ` · ${row.billingAttemptCount} ${plural(row.billingAttemptCount, "attempt")}` : ""}.`,
      href: `${ROUTES.hqBilling}#${billingMembershipAnchorId(row.membershipId)}`,
      actionLabel: "Open billing record",
      sourceLabel: "Billing register",
      affectedCount: 1,
      observedAt: billing.loadedAt,
      dueAt: row.billingNextAttemptAt ?? row.nextChargeDate,
    });
  }
  const issueOverflow = issueRows.length - visibleIssues.length;
  if (issueOverflow > 0) {
    items.push({
      id: "billing:issue-overflow",
      priority: "high",
      domain: "billing",
      title: `${issueOverflow} more billing ${plural(issueOverflow, "exception")}`,
      detail: "Review the remaining failed or intervention-required billing records.",
      href: ROUTES.hqBilling,
      actionLabel: "Open Billing",
      sourceLabel: "Billing register",
      affectedCount: issueOverflow,
      observedAt: billing.loadedAt,
      dueAt: null,
    });
  }

  const issueIds = new Set(issueRows.map((row) => row.membershipId));
  const readyRows = billing.rows.filter(
    (row) => row.billingStatus === "ready_to_charge" && !issueIds.has(row.membershipId),
  );
  if (readyRows.length > 0) {
    const total = readyRows.reduce(
      (sum, row) => sum + (row.jobberScheduledAmount ?? row.visitPrice ?? 0),
      0,
    );
    items.push({
      id: "billing:ready",
      priority: "high",
      domain: "billing",
      title: `${readyRows.length} verified ${plural(readyRows.length, "charge")} ready for review`,
      detail: `${formatDollars(total)} is staged from verified Jobber visits. Review the register before any collection action.`,
      href: `${ROUTES.hqBilling}#${billingMembershipAnchorId(readyRows[0].membershipId)}`,
      actionLabel: "Review first charge",
      sourceLabel: "Billing register",
      affectedCount: readyRows.length,
      observedAt: billing.loadedAt,
      dueAt: readyRows[0].nextChargeDate,
    });
  }

  const setupBlocked = billing.rows.filter(
    (row) =>
      row.billingStatus !== "inactive" &&
      !issueIds.has(row.membershipId) &&
      (!row.billingAuthorizationReady ||
        !row.jobberPropertyPaired ||
        row.stripePaymentStatus !== "card_on_file" ||
        !row.automaticBillingEnabled),
  );
  if (setupBlocked.length > 0) {
    const missingAuthorization = setupBlocked.filter(
      (row) => !row.billingAuthorizationReady,
    ).length;
    const missingPair = setupBlocked.filter((row) => !row.jobberPropertyPaired).length;
    const missingCard = setupBlocked.filter(
      (row) => row.stripePaymentStatus !== "card_on_file",
    ).length;
    const disabled = setupBlocked.filter((row) => !row.automaticBillingEnabled).length;
    const reasons = [
      missingAuthorization ? `${missingAuthorization} authorization` : null,
      missingPair ? `${missingPair} Jobber pair` : null,
      missingCard ? `${missingCard} card` : null,
      disabled ? `${disabled} activation` : null,
    ].filter(Boolean);
    items.push({
      id: "billing:setup-blocked",
      priority: "normal",
      domain: "billing",
      title: `${setupBlocked.length} ${plural(setupBlocked.length, "member")} cannot reach automatic billing`,
      detail: `Missing setup: ${reasons.join(" · ")}. Atlas remains fail-closed until each requirement is proven.`,
      href: `${ROUTES.hqBilling}#${billingMembershipAnchorId(setupBlocked[0].membershipId)}`,
      actionLabel: "Review first member",
      sourceLabel: "Billing register",
      affectedCount: setupBlocked.length,
      observedAt: billing.loadedAt,
      dueAt: null,
    });
  }
}

function addCommunicationsItems(
  items: OwnerAttentionItem[],
  readiness: CommunicationsLaunchReadiness,
) {
  for (const card of [readiness.twilio, readiness.meta]) {
    if (card.state === "ready") continue;
    const needsAction = card.steps
      .filter((step) => step.status === "needs_action")
      .map((step) => step.label);
    items.push({
      id: `communications:${card.id}`,
      priority: card.state === "needs_action" ? "high" : "normal",
      domain: "communications",
      title:
        card.state === "waiting"
          ? `${card.label} is waiting on an external gate`
          : `Finish ${card.label.toLowerCase()} setup`,
      detail:
        needsAction.length > 0
          ? `${card.completedSteps}/${card.totalSteps} verified · next: ${needsAction.slice(0, 3).join(", ")}.`
          : card.summary,
      href: ROUTES.hqCommunications,
      actionLabel: "Open communications",
      sourceLabel: "Communications readiness",
      affectedCount: 1,
      observedAt: readiness.generatedAt,
      dueAt: null,
    });
  }

  if (readiness.scheduler.state !== "ready") {
    items.push({
      id: "communications:scheduler",
      priority: "high",
      domain: "communications",
      title: readiness.scheduler.label,
      detail: readiness.scheduler.detail,
      href: ROUTES.hqCommunications,
      actionLabel: "Open communications",
      sourceLabel: "Communications readiness",
      affectedCount: 1,
      observedAt: readiness.generatedAt,
      dueAt: null,
    });
  }
}

function addReferralItems(
  items: OwnerAttentionItem[],
  snapshot: ReferralAttentionSnapshot,
  now: Date,
) {
  if (snapshot.truncated) {
    items.push({
      id: "referrals:coverage",
      priority: "high",
      domain: "systems",
      title: "Referral attention view reached its coverage limit",
      detail: "Atlas found more than 100 member referral codes. Treat this queue as partial until the referral ledger is paginated.",
      href: "/hq/referrals",
      actionLabel: "Open referrals",
      sourceLabel: "Referral rewards",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
  for (const member of snapshot.members) {
    const rewardCount = Math.max(
      member.convertedUnrewardedCount,
      member.availableRewardCount,
    );
    if (rewardCount > 0) {
      const rewardParts = [
        member.convertedUnrewardedCount > 0
          ? `${member.convertedUnrewardedCount} converted ${plural(member.convertedUnrewardedCount, "referral")}`
          : null,
        member.availableRewardCount > 0
          ? `${member.availableRewardCount} available ${plural(member.availableRewardCount, "reward")}`
          : null,
        member.availableCareCreditCents > 0
          ? `${formatArr(member.availableCareCreditCents)} Care Credit`
          : null,
      ].filter(Boolean);
      items.push({
        id: `referral-reward:${member.membershipId}`,
        priority: "high",
        domain: "growth",
        title: `Review referral rewards for ${member.memberName}`,
        detail: `${rewardParts.join(" · ")}. Confirm the member receives exactly what the ledger proves.`,
        href: `/hq/referrals#${referralMemberAnchorId(member.membershipId)}`,
        actionLabel: "Open referral record",
        sourceLabel: "Referral rewards",
        affectedCount: rewardCount,
        observedAt: snapshot.generatedAt,
        dueAt: member.oldestConvertedAt,
      });
    }

    const oldestPendingAt = timestamp(member.oldestPendingAt);
    const pendingAge = oldestPendingAt === null ? 0 : now.getTime() - oldestPendingAt;
    if (
      member.pendingReferralCount > 0 &&
      pendingAge >= 7 * 24 * 60 * 60 * 1_000
    ) {
      items.push({
        id: `referral-pending:${member.membershipId}`,
        priority: "normal",
        domain: "growth",
        title: `${member.pendingReferralCount} referred ${plural(member.pendingReferralCount, "lead")} still pending`,
        detail: `${member.memberName}’s oldest referred lead has been pending for ${formatWaiting(pendingAge)}. Check the lead record before changing referral status.`,
        href: `/hq/referrals#${referralMemberAnchorId(member.membershipId)}`,
        actionLabel: "Open referral record",
        sourceLabel: "Referral rewards",
        affectedCount: member.pendingReferralCount,
        observedAt: snapshot.generatedAt,
        dueAt: member.oldestPendingAt,
      });
    }
  }
}

function addCustomerAftercareItems(
  items: OwnerAttentionItem[],
  snapshot: CustomerAftercareSnapshot,
  now: Date,
) {
  if (snapshot.truncated) {
    items.push({
      id: "aftercare:coverage",
      priority: "high",
      domain: "systems",
      title: "Customer aftercare view reached its coverage limit",
      detail: "Work the visible care moments, then refresh. Atlas will not treat a bounded result as complete coverage.",
      href: ROUTES.hqAftercare,
      actionLabel: "Open aftercare",
      sourceLabel: "Customer aftercare",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  const orderedCases = [...snapshot.serviceCases].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const visibleCases = orderedCases.slice(0, 5);
  for (const serviceCase of visibleCases) {
    const createdAt = timestamp(serviceCase.createdAt);
    const waitingMs = createdAt === null ? 0 : now.getTime() - createdAt;
    const priority: OwnerAttentionPriority =
      serviceCase.category === "damage_concern"
        ? "critical"
        : serviceCase.status === "open" ||
            waitingMs >= 48 * 60 * 60 * 1_000
          ? "high"
          : "normal";
    const domain: OwnerAttentionDomain =
      serviceCase.category === "billing_question"
        ? "billing"
        : serviceCase.category === "scheduling_question"
          ? "dispatch"
          : "field";
    const detail = serviceCase.details.replace(/\s+/g, " ").trim();
    items.push({
      id: `service-case:${serviceCase.id}`,
      priority,
      domain,
      title: `${serviceCase.homeownerName} reported ${CUSTOMER_SERVICE_CASE_CATEGORY_LABELS[serviceCase.category].toLowerCase()}`,
      detail: `${detail.slice(0, 240)}${detail.length > 240 ? "…" : ""} · ${serviceCase.status === "acknowledged" ? "Acknowledged, still open" : `Waiting ${formatWaiting(Math.max(0, waitingMs))}`}.`,
      href: `${ROUTES.hqAftercare}#${customerServiceCaseAnchorId(serviceCase.id)}`,
      actionLabel: "Open customer case",
      sourceLabel: "Customer aftercare",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: serviceCase.createdAt,
    });
  }

  const caseOverflow = orderedCases.length - visibleCases.length;
  if (caseOverflow > 0) {
    items.push({
      id: "service-case:overflow",
      priority: "high",
      domain: "field",
      title: `${caseOverflow} more open customer ${plural(caseOverflow, "case")}`,
      detail: "Open Customer aftercare to review the remaining member-reported concerns.",
      href: ROUTES.hqAftercare,
      actionLabel: "Open customer cases",
      sourceLabel: "Customer aftercare",
      affectedCount: caseOverflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }

  const ordered = [...snapshot.tasks].sort((left, right) =>
    left.dueAt.localeCompare(right.dueAt),
  );
  const visible = ordered.slice(0, 5);
  for (const task of visible) {
    const dueAt = timestamp(task.dueAt);
    const overdueMs = dueAt === null ? 0 : now.getTime() - dueAt;
    const priority: OwnerAttentionPriority =
      task.type === "review_opportunity"
        ? overdueMs >= 7 * 24 * 60 * 60 * 1_000
          ? "high"
          : "normal"
        : overdueMs >= 14 * 24 * 60 * 60 * 1_000
          ? "high"
          : "normal";
    items.push({
      id: `aftercare:${task.taskKey}`,
      priority,
      domain: "growth",
      title:
        task.type === "review_opportunity"
          ? `${task.homeownerName} has a review-ready visit`
          : `${task.homeownerName} is due for an annual care check-in`,
      detail:
        task.type === "review_opportunity"
          ? `${task.serviceLabel} has customer-visible proof and no open service follow-up. Decide whether to request a review; Atlas will not send automatically.`
          : `Year ${task.anniversaryNumber} is ${overdueMs > 0 ? `${formatWaiting(overdueMs)} overdue` : "approaching"}. Check in on the customer and property before recording the outcome.`,
      href: `${ROUTES.hqAftercare}#${customerAftercareTaskAnchorId(task.taskKey)}`,
      actionLabel: "Open care moment",
      sourceLabel: "Customer aftercare",
      affectedCount: 1,
      observedAt: snapshot.generatedAt,
      dueAt: task.dueAt,
    });
  }

  const overflow = ordered.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "aftercare:overflow",
      priority: "normal",
      domain: "growth",
      title: `${overflow} more customer care ${plural(overflow, "moment")}`,
      detail: "Open aftercare to work the remaining verified review and annual check-in opportunities.",
      href: ROUTES.hqAftercare,
      actionLabel: "Open aftercare",
      sourceLabel: "Customer aftercare",
      affectedCount: overflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
  }
}

function addProductionHealthItems(
  items: OwnerAttentionItem[],
  report: ProductionHealthReport,
) {
  const uncovered = report.sections.flatMap((section) =>
    section.checks.filter(
      (check) =>
        check.status !== "green" &&
        !HEALTH_CHECKS_COVERED_BY_OPERATIONAL_SOURCES.has(check.id),
    ),
  );
  if (uncovered.length === 0) return;
  const red = uncovered.filter((check) => check.status === "red");
  const labels = uncovered.slice(0, 4).map((check) => check.label);
  items.push({
    id: "production-health:uncovered",
    priority: red.length > 0 ? "critical" : "normal",
    domain: "systems",
    title: `${uncovered.length} production ${plural(uncovered.length, "safeguard")} need attention`,
    detail: `${red.length > 0 ? `${red.length} blocking · ` : ""}${labels.join(" · ")}${uncovered.length > labels.length ? " · more" : ""}.`,
    href: ROUTES.hqProductionHealth,
    actionLabel: "Open production health",
    sourceLabel: "Production safeguards",
    affectedCount: uncovered.length,
    observedAt: report.checkedAt,
    dueAt: null,
  });
}

function sourceResultFor(
  input: OwnerAttentionInput,
  id: OwnerAttentionSourceId,
): OwnerAttentionSourceResult<unknown> {
  switch (id) {
    case "owner_sales":
      return input.ownerSales;
    case "sales_retention":
      return input.salesRetention;
    case "today":
      return input.today;
    case "owner_leverage":
      return input.ownerLeverage;
    case "technician_readiness":
      return input.technicianReadiness;
    case "technician_capacity":
      return input.technicianCapacity;
    case "billing":
      return input.billing;
    case "communications":
      return input.communications;
    case "aftercare":
      return input.aftercare;
    case "referrals":
      return input.referrals;
    case "production_health":
      return input.productionHealth;
  }
}

function sortItems(items: OwnerAttentionItem[]): OwnerAttentionItem[] {
  return [...items].sort((left, right) => {
    const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priority !== 0) return priority;
    const leftDue = timestamp(left.dueAt) ?? Number.MAX_SAFE_INTEGER;
    const rightDue = timestamp(right.dueAt) ?? Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left.id.localeCompare(right.id);
  });
}

export function buildOwnerAttentionQueue(
  input: OwnerAttentionInput,
): OwnerAttentionResponse {
  const items: OwnerAttentionItem[] = [];
  const sources: OwnerAttentionSourceStatus[] = [];

  for (const definition of SOURCE_DEFINITIONS) {
    const result = sourceResultFor(input, definition.id);
    sources.push({
      id: definition.id,
      label: definition.label,
      state: result.state,
      detail:
        result.state === "ready"
          ? "Verified from the current system of record."
          : result.detail,
    });
    if (result.state === "degraded") {
      items.push({
        id: `source:${definition.id}`,
        priority: definition.priority,
        domain: definition.domain,
        title: `${definition.label} cannot be verified`,
        detail: `${result.detail} Atlas is treating this source as unknown, not healthy.`,
        href: definition.href,
        actionLabel: "Open source",
        sourceLabel: definition.label,
        affectedCount: 1,
        observedAt: input.now.toISOString(),
        dueAt: null,
      });
    }
  }

  if (input.ownerSales.state === "ready") {
    addOwnerSalesAttentionItems(items, input.ownerSales.data, input.now);
  }
  if (input.salesRetention.state === "ready") {
    addSalesRetentionItems(items, input.salesRetention.data, input.now);
  }
  if (input.today.state === "ready") {
    addTodayItems(items, input.today.data, input.now);
  }
  if (input.ownerLeverage.state === "ready") {
    addOwnerLeverageItems(items, input.ownerLeverage.data, input.now);
  }
  if (input.technicianReadiness.state === "ready") {
    addTechnicianReadinessItems(items, input.technicianReadiness.data);
  }
  if (input.technicianCapacity.state === "ready") {
    addTechnicianCapacityItems(items, input.technicianCapacity.data);
  }
  if (input.billing.state === "ready") {
    addBillingItems(items, input.billing.data);
  }
  if (input.communications.state === "ready") {
    addCommunicationsItems(items, input.communications.data);
  }
  if (input.aftercare.state === "ready") {
    addCustomerAftercareItems(items, input.aftercare.data, input.now);
  }
  if (input.referrals.state === "ready") {
    addReferralItems(items, input.referrals.data, input.now);
  }
  if (input.productionHealth.state === "ready") {
    addProductionHealthItems(items, input.productionHealth.data);
  }

  const sorted = sortItems(items);
  const countFor = (priority: OwnerAttentionPriority) =>
    sorted
      .filter((item) => item.priority === priority)
      .reduce((sum, item) => sum + item.affectedCount, 0);

  return {
    generatedAt: input.now.toISOString(),
    summary: {
      actionCount: sorted.reduce((sum, item) => sum + item.affectedCount, 0),
      itemCount: sorted.length,
      criticalCount: countFor("critical"),
      highCount: countFor("high"),
      normalCount: countFor("normal"),
      degradedSourceCount: sources.filter((source) => source.state === "degraded")
        .length,
    },
    items: sorted,
    sources,
  };
}
