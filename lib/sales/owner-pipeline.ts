import { presentationWorkspacePath } from "@/lib/presentations/navigation";
import {
  buildSalesLeadActionQueue,
  summarizeSalesLeadActionQueue,
  type SalesLeadActionCounts,
  type SalesLeadActionMoment,
} from "./lead-action-priority";
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
}

const PRESENTATION_STATUS_PRIORITY: Record<
  OwnerSalesPresentationSource["status"],
  number
> = {
  signed: 0,
  presented: 1,
  draft: 2,
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

  for (const presentation of input.presentations) {
    if (!presentation.salesRepLeadId) continue;
    const existing = presentationsByLeadId.get(presentation.salesRepLeadId) ?? [];
    existing.push(presentation);
    presentationsByLeadId.set(presentation.salesRepLeadId, existing);
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

    const linked = (presentationsByLeadId.get(item.lead.id) ?? []).filter(
      (presentation) => presentation.salesRepId === rep.id,
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
  };
}
