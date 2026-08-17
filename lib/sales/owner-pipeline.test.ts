import { describe, expect, it } from "vitest";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
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
  serviceInterests: ["exterior_windows"],
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

function inbound(
  id: string,
  submittedAt: string,
  overrides: Partial<LeadIntakeRecord> = {},
): LeadIntakeRecord {
  return {
    id,
    name: `Inbound ${id}`,
    phone: "5305550100",
    email: `${id}@example.com`,
    serviceAddress: "200 Oak Street",
    servicesInterested: ["Window Cleaning"],
    preferredContactMethod: "Phone",
    smsConsentStatus: "unknown",
    smsConsentRecordedAt: null,
    notes: "",
    membershipTier: null,
    squareFootage: null,
    estimatedVisitPrice: null,
    preferredStartWindow: null,
    status: "new",
    submittedAt,
    source: "request_form",
    clientSubmissionId: null,
    externalLeadId: null,
    sourcePageId: null,
    sourceFormId: null,
    sourceCampaignId: null,
    sourceCampaignName: null,
    sourceAdsetId: null,
    sourceAdsetName: null,
    sourceAdId: null,
    sourceAdName: null,
    ...overrides,
  };
}

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
      presentationId: "presentation-base",
      homeownerName: "Mandi Rivera",
      propertyAddress: "88 Oak Way",
      attributedArrCents: 120_000,
      attributedAt: "2026-08-16T17:00:00.000Z",
      paymentSetupEmailState: "card_on_file",
      paymentHandoffProgress: {
        state: "completed",
        canSend: false,
        emailSentAt: "2026-08-16T16:30:00.000Z",
        expiresAt: "2026-08-17T16:30:00.000Z",
      },
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
      unassignedInbound: [],
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
      unassignedInbound: [],
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
      unassignedInbound: [],
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
      unassignedInbound: [],
      handoffs: [
        handoffSource(REPS[0], {
          attributionId: "attribution-ready",
        }),
        handoffSource(REPS[1], {
          attributionId: "attribution-payment",
          membershipId: "membership-payment",
          homeownerName: "Joani Cole",
          paymentSetupEmailState: "ready",
          paymentHandoffProgress: {
            state: "not_started",
            canSend: true,
            emailSentAt: null,
            expiresAt: null,
          },
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
      waitingCount: 0,
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

  it("counts an accepted active card link as waiting instead of owner work", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      unassignedInbound: [],
      handoffs: [
        handoffSource(REPS[1], {
          stage: "payment_pending",
          label: "Waiting on customer card setup",
          detail: "The secure Stripe email was accepted.",
          completedSteps: 1,
          paymentSetupEmailState: "ready",
          paymentHandoffProgress: {
            state: "email_sent",
            canSend: false,
            emailSentAt: "2026-08-16T17:30:00.000Z",
            expiresAt: "2026-08-17T17:30:00.000Z",
          },
        }),
      ],
      reference,
    });

    expect(snapshot.handoffs.summary).toMatchObject({
      signedCount: 1,
      actionCount: 0,
      waitingCount: 1,
      readyCount: 0,
    });
  });

  it("marks signed handoff truth unavailable instead of reporting a false zero", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      unassignedInbound: [],
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
        waitingCount: null,
        scheduleUnknownCount: null,
      },
    });
  });

  it("surfaces the newest unassigned inbound requests without truncating the count", () => {
    const unassignedInbound = Array.from({ length: 10 }, (_, index) =>
      inbound(
        `request-${index}`,
        new Date(reference.getTime() - index * 60_000).toISOString(),
        index === 0 ? { source: "facebook_lead_ad" } : {},
      ),
    );
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      unassignedInbound: [...unassignedInbound].reverse(),
      inboundRouting: {
        status: "active",
        ownerSlug: "noah",
        ownerDisplayName: "Noah",
        followUpMinutes: 15,
      },
      handoffs: [],
      reference,
    });

    expect(snapshot.inbound).toMatchObject({
      status: "available",
      count: 10,
      routing: {
        status: "active",
        ownerSlug: "noah",
        ownerDisplayName: "Noah",
        followUpMinutes: 15,
      },
    });
    expect(snapshot.inbound.records).toHaveLength(8);
    expect(snapshot.inbound.records.map((lead) => lead.id)).toEqual(
      unassignedInbound.slice(0, 8).map((lead) => lead.id),
    );
  });

  it("marks inbound ownership truth unavailable instead of showing a false zero", () => {
    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [],
      presentations: [],
      unassignedInbound: null,
      handoffs: [],
      reference,
    });

    expect(snapshot.inbound).toEqual({
      status: "unavailable",
      count: null,
      records: [],
      routing: {
        status: "not_configured",
        ownerSlug: null,
        ownerDisplayName: null,
        followUpMinutes: 15,
      },
    });
  });
});
