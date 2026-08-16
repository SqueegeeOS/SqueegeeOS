import { presentationWorkspacePath } from "@/lib/presentations/navigation";
import {
  buildSalesLeadActionQueue,
  summarizeSalesLeadActionQueue,
  type SalesLeadActionCounts,
  type SalesLeadActionMoment,
} from "./lead-action-priority";
import type {
  SalesProductionHandoffRecord,
  SalesProductionHandoffStage,
} from "./production-handoff";
import type { SalesRepPlan } from "./rep-config";
import type { SalesRepLead } from "./workspace-types";

export interface OwnerSalesRepSource {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string;
  plan: SalesRepPlan;
  workspacePath: string;
}

export interface OwnerSalesLeadSource {
  repId: string;
  repSlug: string;
  lead: SalesRepLead;
}

export interface OwnerSalesPresentationSource {
  id: string;
  salesRepId: string | null;
  salesRepLeadId: string | null;
  leadIntakeId: string | null;
  status: "draft" | "presented" | "signed";
  updatedAt: string;
}

export type OwnerSalesPresentationState =
  | "none"
  | "linked"
  | "needs_attention";

export interface OwnerSalesPipelineLead extends SalesRepLead {
  repId: string;
  repSlug: string;
  repDisplayName: string;
  repPlan: SalesRepPlan;
  actionMoment: SalesLeadActionMoment;
  presentationState: OwnerSalesPresentationState;
  presentationCount: number;
  presentationId: string | null;
  presentationStatus: OwnerSalesPresentationSource["status"] | null;
  presentationHref: string;
}

export interface OwnerSalesRepSummary extends OwnerSalesRepSource {
  openLeadCount: number;
  pipelineArrCents: number;
  dueNowCount: number;
  unscheduledCount: number;
}

export interface OwnerSalesHandoffSource {
  repId: string;
  repSlug: string;
  repDisplayName: string;
  repWorkspacePath: string;
  handoff: SalesProductionHandoffRecord;
}

export interface OwnerSalesPipelineHandoff
  extends SalesProductionHandoffRecord {
  repId: string;
  repSlug: string;
  repDisplayName: string;
  repWorkspacePath: string;
}

export interface OwnerSalesHandoffQueue {
  status: "available" | "unavailable";
  generatedAt: string;
  summary: {
    signedCount: number | null;
    readyCount: number | null;
    actionCount: number | null;
    scheduleUnknownCount: number | null;
  };
  records: OwnerSalesPipelineHandoff[];
}

export interface OwnerSalesPipelineSnapshot {
  generatedAt: string;
  summary: {
    activeRepCount: number;
    openLeadCount: number;
    pipelineArrCents: number;
    dueNowCount: number;
    unscheduledCount: number;
    presentationNeedsAttentionCount: number;
    actionCounts: SalesLeadActionCounts;
  };
  reps: OwnerSalesRepSummary[];
  leads: OwnerSalesPipelineLead[];
  handoffs: OwnerSalesHandoffQueue;
}

const PRESENTATION_STATUS_PRIORITY: Record<
  OwnerSalesPresentationSource["status"],
  number
> = {
  signed: 0,
  presented: 1,
  draft: 2,
};

const HANDOFF_STAGE_PRIORITY: Record<SalesProductionHandoffStage, number> = {
  payment_needed: 0,
  membership_attention: 1,
  property_pairing_needed: 2,
  job_pairing_needed: 3,
  source_unavailable: 4,
  schedule_needed: 5,
  ready: 6,
};

function presentationTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function presentationForLead(
  presentations: OwnerSalesPresentationSource[],
): OwnerSalesPresentationSource | null {
  return [...presentations].sort((left, right) => {
    const statusDifference =
      PRESENTATION_STATUS_PRIORITY[left.status] -
      PRESENTATION_STATUS_PRIORITY[right.status];
    if (statusDifference !== 0) return statusDifference;
    const timeDifference =
      presentationTimestamp(right.updatedAt) -
      presentationTimestamp(left.updatedAt);
    return timeDifference || left.id.localeCompare(right.id);
  })[0] ?? null;
}

function newPresentationHref(repSlug: string, leadId: string): string {
  const params = new URLSearchParams({ rep: repSlug, lead: leadId });
  return `/presentations/new?${params.toString()}`;
}

export function buildOwnerSalesPipelineSnapshot(input: {
  reps: OwnerSalesRepSource[];
  leads: OwnerSalesLeadSource[];
  presentations: OwnerSalesPresentationSource[];
  handoffs: OwnerSalesHandoffSource[] | null;
  reference?: Date;
}): OwnerSalesPipelineSnapshot {
  const reference = input.reference ?? new Date();
  const repsById = new Map(input.reps.map((rep) => [rep.id, rep]));
  const leadSourcesById = new Map(
    input.leads.map((source) => [source.lead.id, source]),
  );
  const presentationsByLeadId = new Map<
    string,
    OwnerSalesPresentationSource[]
  >();
  const presentationsByLeadIntakeId = new Map<
    string,
    OwnerSalesPresentationSource[]
  >();

  for (const presentation of input.presentations) {
    if (presentation.salesRepLeadId) {
      const existing = presentationsByLeadId.get(presentation.salesRepLeadId) ?? [];
      existing.push(presentation);
      presentationsByLeadId.set(presentation.salesRepLeadId, existing);
    }
    if (presentation.leadIntakeId) {
      const existing =
        presentationsByLeadIntakeId.get(presentation.leadIntakeId) ?? [];
      existing.push(presentation);
      presentationsByLeadIntakeId.set(presentation.leadIntakeId, existing);
    }
  }

  const queue = buildSalesLeadActionQueue(
    input.leads.map((source) => source.lead),
    reference,
  );
  const actionCounts = summarizeSalesLeadActionQueue(queue);
  const leads: OwnerSalesPipelineLead[] = queue.flatMap((item) => {
    const source = leadSourcesById.get(item.lead.id);
    const rep = source ? repsById.get(source.repId) : null;
    if (!source || !rep) return [];

    const linked = [
      ...(presentationsByLeadId.get(item.lead.id) ?? []),
      ...(item.lead.leadIntakeId
        ? (presentationsByLeadIntakeId.get(item.lead.leadIntakeId) ?? [])
        : []),
    ].filter(
      (presentation, index, records) =>
        presentation.salesRepId === rep.id &&
        records.findIndex((candidate) => candidate.id === presentation.id) ===
          index,
    );
    const presentation = presentationForLead(linked);

    return [
      {
        ...item.lead,
        repId: rep.id,
        repSlug: rep.slug,
        repDisplayName: rep.displayName,
        repPlan: rep.plan,
        actionMoment: item.moment,
        presentationState:
          linked.length > 1
            ? "needs_attention"
            : presentation
              ? "linked"
              : "none",
        presentationCount: linked.length,
        presentationId: presentation?.id ?? null,
        presentationStatus: presentation?.status ?? null,
        presentationHref: presentation
          ? presentationWorkspacePath(presentation)
          : newPresentationHref(rep.slug, item.lead.id),
      },
    ];
  });

  const reps = input.reps
    .map((rep): OwnerSalesRepSummary => {
      const repLeads = leads.filter((lead) => lead.repId === rep.id);
      return {
        ...rep,
        openLeadCount: repLeads.length,
        pipelineArrCents: repLeads.reduce(
          (sum, lead) => sum + lead.estimatedArrCents,
          0,
        ),
        dueNowCount: repLeads.filter((lead) =>
          ["overdue", "due_today"].includes(lead.actionMoment),
        ).length,
        unscheduledCount: repLeads.filter(
          (lead) => lead.actionMoment === "unscheduled",
        ).length,
      };
    })
    .sort((left, right) => {
      if (left.plan !== right.plan) {
        return left.plan === "founding_david" ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName);
    });
  const handoffRecords = (input.handoffs ?? [])
    .map(
      (source): OwnerSalesPipelineHandoff => ({
        ...source.handoff,
        repId: source.repId,
        repSlug: source.repSlug,
        repDisplayName: source.repDisplayName,
        repWorkspacePath: source.repWorkspacePath,
      }),
    )
    .sort((left, right) => {
      const stageDifference =
        HANDOFF_STAGE_PRIORITY[left.stage] -
        HANDOFF_STAGE_PRIORITY[right.stage];
      if (stageDifference !== 0) return stageDifference;
      const timeDifference =
        presentationTimestamp(right.attributedAt) -
        presentationTimestamp(left.attributedAt);
      return timeDifference || left.attributionId.localeCompare(right.attributionId);
    });
  const handoffsAvailable = input.handoffs !== null;
  const readyCount = handoffRecords.filter(
    (handoff) => handoff.stage === "ready",
  ).length;
  const scheduleUnknownCount = handoffRecords.filter(
    (handoff) => handoff.stage === "source_unavailable",
  ).length;

  return {
    generatedAt: reference.toISOString(),
    summary: {
      activeRepCount: reps.length,
      openLeadCount: leads.length,
      pipelineArrCents: leads.reduce(
        (sum, lead) => sum + lead.estimatedArrCents,
        0,
      ),
      dueNowCount: actionCounts.overdue + actionCounts.due_today,
      unscheduledCount: actionCounts.unscheduled,
      presentationNeedsAttentionCount: leads.filter(
        (lead) => lead.presentationState === "needs_attention",
      ).length,
      actionCounts,
    },
    reps,
    leads,
    handoffs: {
      status: handoffsAvailable ? "available" : "unavailable",
      generatedAt: reference.toISOString(),
      summary: {
        signedCount: handoffsAvailable ? handoffRecords.length : null,
        readyCount: handoffsAvailable ? readyCount : null,
        actionCount: handoffsAvailable
          ? handoffRecords.length - readyCount
          : null,
        scheduleUnknownCount: handoffsAvailable
          ? scheduleUnknownCount
          : null,
      },
      records: handoffRecords,
    },
  };
}
