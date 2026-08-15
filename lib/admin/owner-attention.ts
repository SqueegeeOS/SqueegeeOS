import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import type {
  BillingRegisterRow,
  BillingWorkspaceData,
} from "@/lib/admin/billing-workspace-types";
import { billingMembershipAnchorId } from "@/lib/admin/billing-workspace-links";
import type { ProductionHealthReport } from "@/lib/admin/production-health-types";
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
import { ROUTES } from "@/lib/navigation/config";
import { buildSalesLeadActionQueue } from "@/lib/sales/lead-action-priority";
import type { SalesLeadAttentionSnapshot } from "@/lib/sales/workspace-types";

export type OwnerAttentionPriority = "critical" | "high" | "normal";
export type OwnerAttentionDomain =
  | "leads"
  | "sales"
  | "dispatch"
  | "field"
  | "billing"
  | "communications"
  | "systems";
export type OwnerAttentionSourceState = "ready" | "degraded";
export type OwnerAttentionSourceId =
  | "customer_leads"
  | "david_pipeline"
  | "today"
  | "billing"
  | "communications"
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
  customerLeads: OwnerAttentionSourceResult<LeadIntakeRecord[]>;
  davidPipeline: OwnerAttentionSourceResult<SalesLeadAttentionSnapshot>;
  today: OwnerAttentionSourceResult<JobberTodayData>;
  billing: OwnerAttentionSourceResult<BillingWorkspaceData>;
  communications: OwnerAttentionSourceResult<CommunicationsLaunchReadiness>;
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
    id: "customer_leads",
    label: "Website & Facebook leads",
    domain: "leads",
    href: ROUTES.hqPendingRequests,
    priority: "high",
  },
  {
    id: "david_pipeline",
    label: "David pipeline",
    domain: "sales",
    href: "/david#follow-ups",
    priority: "high",
  },
  {
    id: "today",
    label: "Today & field proof",
    domain: "dispatch",
    href: ROUTES.hqToday,
    priority: "critical",
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

function firstUsefulLeadContext(lead: LeadIntakeRecord): string {
  const service = lead.servicesInterested[0];
  return [
    lead.source === "facebook_lead_ad" ? "Facebook lead" : "Website request",
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

function addDavidPipelineItems(
  items: OwnerAttentionItem[],
  snapshot: SalesLeadAttentionSnapshot,
  now: Date,
) {
  const queue = buildSalesLeadActionQueue(snapshot.leads, now).filter(
    (item) => item.moment !== "upcoming",
  );
  const visible = queue.slice(0, 5);

  for (const item of visible) {
    const followUpAt = timestamp(item.lead.nextFollowUpAt);
    const overdueMs = followUpAt === null ? 0 : now.getTime() - followUpAt;
    const priority: OwnerAttentionPriority =
      item.moment === "overdue" && overdueMs >= 24 * 60 * 60 * 1_000
        ? "critical"
        : item.moment === "unscheduled"
          ? "normal"
          : "high";
    const timing =
      item.moment === "overdue"
        ? `Follow-up overdue by ${formatWaiting(overdueMs)}`
        : item.moment === "due_today"
          ? "Follow-up is due today"
          : "No next check-in is scheduled";
    items.push({
      id: `david-lead:${item.lead.id}`,
      priority,
      domain: "sales",
      title: `${snapshot.profile.displayName}: ${item.lead.fullName}`,
      detail: `${timing} · ${formatArr(item.lead.estimatedArrCents)} potential ARR · ${item.lead.status.replaceAll("_", " ")}.`,
      href: `${snapshot.profile.workspacePath}#follow-ups`,
      actionLabel: "Open pipeline",
      sourceLabel: `${snapshot.profile.displayName} pipeline`,
      affectedCount: 1,
      observedAt: item.lead.updatedAt,
      dueAt: item.lead.nextFollowUpAt,
    });
  }

  const overflow = queue.length - visible.length;
  if (overflow > 0) {
    items.push({
      id: "david-lead:overflow",
      priority: "normal",
      domain: "sales",
      title: `${overflow} more ${snapshot.profile.displayName} pipeline ${plural(overflow, "action")}`,
      detail: "Open the field workspace to schedule or complete the remaining check-ins.",
      href: `${snapshot.profile.workspacePath}#follow-ups`,
      actionLabel: "Open pipeline",
      sourceLabel: `${snapshot.profile.displayName} pipeline`,
      affectedCount: overflow,
      observedAt: snapshot.generatedAt,
      dueAt: null,
    });
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
    case "customer_leads":
      return input.customerLeads;
    case "david_pipeline":
      return input.davidPipeline;
    case "today":
      return input.today;
    case "billing":
      return input.billing;
    case "communications":
      return input.communications;
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

  if (input.customerLeads.state === "ready") {
    addCustomerLeadItems(items, input.customerLeads.data, input.now);
  }
  if (input.davidPipeline.state === "ready") {
    addDavidPipelineItems(items, input.davidPipeline.data, input.now);
  }
  if (input.today.state === "ready") {
    addTodayItems(items, input.today.data, input.now);
  }
  if (input.billing.state === "ready") {
    addBillingItems(items, input.billing.data);
  }
  if (input.communications.state === "ready") {
    addCommunicationsItems(items, input.communications.data);
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
