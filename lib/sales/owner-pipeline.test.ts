import { describe, expect, it } from "vitest";
import type { SalesRepLead } from "./workspace-types";
import {
  buildOwnerSalesPipelineSnapshot,
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
  fullName: "Homeowner",
  propertyAddress: "100 Main Street",
  phone: null,
  email: null,
  status: "follow_up",
  estimatedArrCents: 120_000,
  nextFollowUpAt: null,
  notes: "",
  smsConsentStatus: "unknown",
  emailConsentStatus: "unknown",
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
        status: "draft",
        updatedAt: "2026-08-16T18:00:00.000Z",
      },
      {
        id: "presentation-signed",
        salesRepId: REPS[1].id,
        salesRepLeadId: lead.lead.id,
        status: "signed",
        updatedAt: "2026-08-15T18:00:00.000Z",
      },
      {
        id: "wrong-rep",
        salesRepId: REPS[0].id,
        salesRepLeadId: lead.lead.id,
        status: "signed",
        updatedAt: "2026-08-17T18:00:00.000Z",
      },
    ];

    const snapshot = buildOwnerSalesPipelineSnapshot({
      reps: REPS,
      leads: [lead],
      presentations,
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
});
