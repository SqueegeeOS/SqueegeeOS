import { formatBusinessCalendarDate } from "@/lib/admin/company-business-timezone";
import type { SalesRepLead } from "./workspace-types";

export type SalesLeadActionMoment =
  | "overdue"
  | "due_today"
  | "unscheduled"
  | "upcoming";

export interface SalesLeadActionQueueItem {
  lead: SalesRepLead;
  moment: SalesLeadActionMoment;
}

export type SalesLeadActionCounts = Record<SalesLeadActionMoment, number>;

const MOMENT_PRIORITY: Record<SalesLeadActionMoment, number> = {
  overdue: 0,
  due_today: 1,
  unscheduled: 2,
  upcoming: 3,
};

function parsedTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function classifySalesLeadAction(
  lead: Pick<SalesRepLead, "nextFollowUpAt">,
  reference: Date = new Date(),
): SalesLeadActionMoment {
  const followUpAt = parsedTimestamp(lead.nextFollowUpAt);
  const referenceAt = reference.getTime();
  if (followUpAt === null || !Number.isFinite(referenceAt)) {
    return "unscheduled";
  }
  if (followUpAt <= referenceAt) return "overdue";
  return formatBusinessCalendarDate(new Date(followUpAt)) ===
    formatBusinessCalendarDate(reference)
    ? "due_today"
    : "upcoming";
}

export function buildSalesLeadActionQueue(
  leads: SalesRepLead[],
  reference: Date = new Date(),
): SalesLeadActionQueueItem[] {
  return leads
    .filter((lead) => !["signed", "won", "lost"].includes(lead.status))
    .map((lead) => ({
      lead,
      moment: classifySalesLeadAction(lead, reference),
    }))
    .sort((left, right) => {
      const priorityDifference =
        MOMENT_PRIORITY[left.moment] - MOMENT_PRIORITY[right.moment];
      if (priorityDifference !== 0) return priorityDifference;

      const leftFollowUp = parsedTimestamp(left.lead.nextFollowUpAt);
      const rightFollowUp = parsedTimestamp(right.lead.nextFollowUpAt);
      if (leftFollowUp !== null && rightFollowUp !== null) {
        return leftFollowUp - rightFollowUp;
      }

      return (
        (parsedTimestamp(right.lead.updatedAt) ?? 0) -
        (parsedTimestamp(left.lead.updatedAt) ?? 0)
      );
    });
}

export function summarizeSalesLeadActionQueue(
  queue: SalesLeadActionQueueItem[],
): SalesLeadActionCounts {
  const counts: SalesLeadActionCounts = {
    overdue: 0,
    due_today: 0,
    unscheduled: 0,
    upcoming: 0,
  };
  for (const item of queue) counts[item.moment] += 1;
  return counts;
}

/**
 * The field desk should interrupt the rep only for work that needs attention
 * now. Future follow-ups remain in the complete queue without displacing the
 * next real door.
 */
export function selectFieldNextMove(
  queue: SalesLeadActionQueueItem[],
): SalesLeadActionQueueItem | null {
  return queue.find((item) => item.moment !== "upcoming") ?? null;
}
