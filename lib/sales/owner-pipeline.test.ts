import { describe, expect, it } from "vitest";
import type { SalesRepLead } from "./workspace-types";
import {
  buildOwnerSalesPipelineSnapshot,
  type OwnerSalesHandoffSource,
  type OwnerSalesLeadSource,
  type OwnerSalesPresentationSource,
  type OwnerSalesRepSource,
} from "./owner-pipeline";

const REPS: OwnerSalesRepSource[] = [
  {
    id: "rep-standard",
    slug: "noah",
    displayName: "Noah",
    roleTitle: "Membership Advisor",
    plan: "standard_commission",
    workspacePath: "/sales/noah",
  },
  {
    id: "rep-david",
    slug: "david",
    displayName: "David",
    roleTitle: "Founding Membership Advisor",
    plan: "founding_david",
    workspacePath: "/david",
  },
];

const BASE_LEAD: SalesRepLead = {
  id: "lead-base",
  leadIntakeId: null,
  fullName: "Homeowner",
  propertyAddress: "100 Main Street",
  phone: null,
  email: null,
  status: "follow_up",
  source: "door_to_door",
  estimatedArrCents: 120_000,
  nextFollowUpAt: null,
  notes: "",
  smsConsentStatus: "unknown",
  emailConsentStatus: "unknown",
  closeJourney: null,
  recentInteractions: [],
  createdAt: "2026-08-15T16:00:00.000Z",
  updatedAt: "2026-08-15T16:00:00.000Z",
};

function source(
  rep: OwnerSalesRepSource,
  lead: Partial<SalesRepLead> & Pick<SalesRepLead, "id">,
): OwnerSalesLeadSource {
  return {
    repId: rep.id,
    repSlug: rep.slug,
    lead: { ...BASE_LEAD, ...lead },
  };
}

function handoffSource(
  rep: OwnerSalesRepSource,
  overrides: Partial<OwnerSalesHandoffSource["handoff"]> = {},
): OwnerSalesHandoffSource {
  return {
    repId: rep.id,
    repSlug: rep.slug,
    repDisplayName: rep.displayName,
    repWorkspacePath: rep.workspacePath,
    handoff: {
      attributionId: "attribution-base",
      membershipId: "membership-base",
      homeownerName: "Mandi Rivera",
      propertyAddress: "88 Oak Way",
      attributedArrCents: 120_000,
      attributedAt: "2026-08-16T17:00:00.000Z",
      paymentSetupEmailState: "card_on_file",
      stage: "ready",
      label: "Production ready",
      detail: "All five proofs are verified.",
      completedSteps: 5,
      totalSteps: 5,
      actionLabel: "Open member record",
      actionHref: "/hq/customers/membership/membership-base",
      nextScheduledAt: "2026-09-01T16:00:00.000Z",
      scheduleObservedAt: "2026-08-16T16:00:00.000Z",
      ...overrides,
    },
  };
}

describe("owner sales pipeline", () => {
  const reference = new Date("2026-08-16T18:00:00.000Z");

  it("builds one globally prioritized owner queue and preserves David's special track", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [
        source(REPS[0], {
          id: "lead-upcoming",
          estimatedArrCents: 80_000,
          nextFollowUpAt: "2026-08-18T18:00:00.000Z",
        }),
        source(REPS[1], {
          id: "lead-overdue",
          estimatedArrCents: 150_000,
          nextFollowUpAt: "2026-08-15T18:00:00.000Z",
        }),
        source(REPS[1], { id: "lead-unscheduled" }),
      ],
      presentations: [],
      handoffs: [],
      reference,
    });

    expect(snapshot.leads.map((lead) => lead.id)).toEqual([
      "lead-overdue",
      "lead-unscheduled",
      "lead-upcoming",
    ]);
    expect(snapshot.summary).toMatchObject({
      activeRepCount: 2,
      openLeadCount: 3,
      pipelineArrCents: 350_000,
      dueNowCount: 1,
      unscheduledCount: 1,
    });
    expect(snapshot.reps[0]).toMatchObject({
      slug: "david",
      plan: "founding_david",
      openLeadCount: 2,
      pipelineArrCents: 270_000,
    });
    expect(snapshot.leads[0].presentationHref).toBe(
      "/presentations/new?rep=david&lead=lead-overdue",
    );
  });

  it("selects the signed presentation while surfacing duplicate lineage", () => {
    const lead = source(REPS[1], { id: "lead-linked" });
    const presentations: OwnerSalesPresentationSource[] = [
      {
        id: "presentation-draft",
        salesRepId: REPS[1].id,
        salesRepLeadId: lead.lead.id,
        leadIntakeId: null,
        status: "draft",
        updatedAt: "2026-08-16T18:00:00.000Z",
      },
      {
        id: "presentation-signed",
        salesRepId: REPS[1].id,
        salesRepLeadId: lead.lead.id,
        leadIntakeId: null,
        status: "signed",
        updatedAt: "2026-08-15T18:00:00.000Z",
      },
      {
        id: "wrong-rep",
        salesRepId: REPS[0].id,
        salesRepLeadId: lead.lead.id,
        leadIntakeId: null,
        status: "signed",
        updatedAt: "2026-08-17T18:00:00.000Z",
      },
    ];

    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [lead],
      presentations,
      handoffs: [],
      reference,
    });

    expect(snapshot.leads[0]).toMatchObject({
      presentationState: "needs_attention",
      presentationCount: 2,
      presentationId: "presentation-signed",
      presentationStatus: "signed",
      presentationHref: "/presentations/presentation-signed/present",
    });
    expect(snapshot.summary.presentationNeedsAttentionCount).toBe(1);
  });

  it("links an intake-originated presentation back to its operational rep lead", () => {
    const lead = source(REPS[1], {
      id: "lead-request",
      leadIntakeId: "intake-request",
      source: "request_form",
    });
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [lead],
      presentations: [
        {
          id: "presentation-request",
          salesRepId: REPS[1].id,
          salesRepLeadId: null,
          leadIntakeId: "intake-request",
          status: "draft",
          updatedAt: "2026-08-16T18:00:00.000Z",
        },
      ],
      handoffs: [],
      reference,
    });

    expect(snapshot.leads[0]).toMatchObject({
      presentationState: "linked",
      presentationId: "presentation-request",
      presentationHref: "/presentations/presentation-request/edit",
    });
  });

  it("keeps agreement-backed closes in one owner queue until production is ready", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      handoffs: [
        handoffSource(REPS[0], {
          attributionId: "attribution-ready",
        }),
        handoffSource(REPS[1], {
          attributionId: "attribution-payment",
          membershipId: "membership-payment",
          homeownerName: "Joani Cole",
          paymentSetupEmailState: "ready",
          stage: "payment_needed",
          label: "Payment setup needed",
          detail: "The signed customer still needs a card on file.",
          completedSteps: 1,
          actionLabel: "Finish payment setup",
          actionHref: "/hq/customers/membership/membership-payment",
          nextScheduledAt: null,
        }),
      ],
      reference,
    });

    expect(snapshot.handoffs.status).toBe("available");
    expect(snapshot.handoffs.summary).toEqual({
      signedCount: 2,
      readyCount: 1,
      actionCount: 1,
      scheduleUnknownCount: 0,
    });
    expect(snapshot.handoffs.records.map((handoff) => handoff.attributionId)).toEqual([
      "attribution-payment",
      "attribution-ready",
    ]);
    expect(snapshot.handoffs.records[0]).toMatchObject({
      repSlug: "david",
      repWorkspacePath: "/david",
      homeownerName: "Joani Cole",
      completedSteps: 1,
    });
  });

  it("marks signed handoff truth unavailable instead of reporting a false zero", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      handoffs: null,
      reference,
    });

    expect(snapshot.handoffs).toMatchObject({
      status: "unavailable",
      records: [],
      summary: {
        signedCount: null,
        readyCount: null,
        actionCount: null,
        scheduleUnknownCount: null,
      },
    });
  });
});
