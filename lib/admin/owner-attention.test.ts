import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import type {
  BillingRegisterRow,
  BillingWorkspaceData,
} from "@/lib/admin/billing-workspace-types";
import type { ProductionHealthReport } from "@/lib/admin/production-health-types";
import {
  emptyOwnerLeverageMetrics,
  type OwnerLeverageSnapshot,
} from "@/lib/admin/owner-leverage";
import type { CustomerAftercareSnapshot } from "@/lib/aftercare/customer-aftercare";
import type { JobberTodayData, JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";
import type { CommunicationsLaunchReadiness } from "@/lib/communications/integration-launch-readiness-core";
import type { VisitFieldFollowUpView } from "@/lib/field-records/visit-field-record";
import type { TechnicianReadinessSnapshot } from "@/lib/field-operations/technician-readiness";
import type {
  TechnicianCapacitySnapshot,
  TechnicianCapacityWeekDemand,
  TechnicianCapacityWeekForecast,
} from "@/lib/field-operations/technician-capacity";
import type { ReferralAttentionSnapshot } from "@/lib/referrals/attention-types";
import type { SalesRetentionAttentionSnapshot } from "@/lib/sales/attribution-lifecycle";
import {
  buildOwnerSalesPipelineSnapshot,
  type OwnerSalesAttentionSnapshot,
  type OwnerSalesHandoffSource,
  type OwnerSalesLeadSource,
  type OwnerSalesRepSource,
} from "@/lib/sales/owner-pipeline";
import {
  deriveSalesProductionHandoff,
  type SalesProductionHandoffRecord,
} from "@/lib/sales/production-handoff";
import type { SalesRepLead } from "@/lib/sales/workspace-types";
import {
  buildOwnerAttentionQueue,
  type OwnerAttentionInput,
} from "./owner-attention";

const NOW = new Date("2026-08-14T18:00:00.000Z");

function ready<T>(data: T) {
  return { state: "ready" as const, data };
}

function launchCard(
  id: "twilio" | "meta",
  state: "ready" | "waiting" | "needs_action" = "ready",
) {
  return {
    id,
    label: id === "twilio" ? "Two-way texting" : "Facebook lead intake",
    state,
    summary: state === "ready" ? "Verified." : "Setup remains.",
    completedSteps: state === "ready" ? 1 : 0,
    totalSteps: 1,
    actionUrl: "https://example.com",
    actionLabel: "Open",
    callbackUrls: [],
    steps: [
      {
        id: "proof",
        label: "Signed proof",
        status: state === "ready" ? "complete" : state,
        detail: "Proof state.",
      },
    ],
  } as CommunicationsLaunchReadiness["twilio"];
}

function healthyCommunications(): CommunicationsLaunchReadiness {
  return {
    generatedAt: NOW.toISOString(),
    twilio: launchCard("twilio"),
    meta: launchCard("meta"),
    scheduler: {
      state: "ready",
      label: "Runner secured",
      detail: "Verified.",
      route: "/api/cron/jobber-reconcile",
    },
  };
}

function healthyToday(overrides: Partial<JobberTodayData> = {}): JobberTodayData {
  return {
    calendarDate: "2026-08-14",
    timezone: "America/Los_Angeles",
    connected: true,
    connectionStatus: "connected",
    accountName: "Squeegee King",
    lastSyncedAt: "2026-08-14T17:30:00.000Z",
    loadedAt: NOW.toISOString(),
    fieldRecordStatusAvailable: true,
    fieldEventStatusAvailable: true,
    independenceReviewStatusAvailable: true,
    summary: {
      total: 0,
      complete: 0,
      remaining: 0,
      documented: 0,
      portalUpdated: 0,
      completedWithoutRecord: 0,
      completedWithPrivateOnlyRecord: 0,
      jobberCompletionPending: 0,
      assigned: 0,
      unassigned: 0,
      assignmentUnknown: 0,
    },
    visits: [],
    fieldFollowUps: [],
    ...overrides,
  };
}

function healthyBilling(overrides: Partial<BillingWorkspaceData> = {}): BillingWorkspaceData {
  return {
    overview: {
      readyToBillCount: 0,
      expectedRevenueThisMonth: 0,
      collectedThisMonth: 0,
      upcomingChargesCount: 0,
      activeMembershipCount: 0,
    },
    rows: [],
    loadedAt: NOW.toISOString(),
    stripeDashboardLive: true,
    ...overrides,
  };
}

function healthyProduction(): ProductionHealthReport {
  return {
    onboardingSafe: "green",
    summary: "Production is ready.",
    sections: [],
    checkedAt: NOW.toISOString(),
  };
}

const OWNER_REPS: OwnerSalesRepSource[] = [
  {
    id: "rep-david",
    slug: "david",
    displayName: "David",
    roleTitle: "Founding Membership Advisor",
    plan: "founding_david",
    workspacePath: "/david",
  },
  {
    id: "rep-noah",
    slug: "noah",
    displayName: "Noah Thomas",
    roleTitle: "Founder & Growth Operator",
    plan: "standard_commission",
    workspacePath: "/sales/noah",
  },
];

function repSource(slug: "david" | "noah"): OwnerSalesRepSource {
  return OWNER_REPS.find((rep) => rep.slug === slug)!;
}

function salesLeadSource(
  slug: "david" | "noah",
  lead: SalesRepLead,
): OwnerSalesLeadSource {
  const rep = repSource(slug);
  return { repId: rep.id, repSlug: rep.slug, lead };
}

function salesHandoffSource(
  slug: "david" | "noah",
  handoff: SalesProductionHandoffRecord,
): OwnerSalesHandoffSource {
  const rep = repSource(slug);
  return {
    repId: rep.id,
    repSlug: rep.slug,
    repDisplayName: rep.displayName,
    repWorkspacePath: rep.workspacePath,
    handoff,
  };
}

function ownerSalesSnapshot(
  input: {
    unassignedInbound?: LeadIntakeRecord[] | null;
    leads?: OwnerSalesLeadSource[];
    handoffs?: OwnerSalesHandoffSource[] | null;
  } = {},
): OwnerSalesAttentionSnapshot {
  const unassignedInbound =
    input.unassignedInbound === undefined ? [] : input.unassignedInbound;
  return {
    pipeline: buildOwnerSalesPipelineSnapshot({
      reps: OWNER_REPS,
      leads: input.leads ?? [],
      presentations: [],
      unassignedInbound,
      handoffs: input.handoffs === undefined ? [] : input.handoffs,
      reference: NOW,
    }),
    unassignedInbound,
  };
}

function healthySalesRetention(): SalesRetentionAttentionSnapshot {
  return { generatedAt: NOW.toISOString(), records: [], truncated: false };
}

function healthyReferrals(): ReferralAttentionSnapshot {
  return { generatedAt: NOW.toISOString(), members: [], truncated: false };
}

function healthyAftercare(): CustomerAftercareSnapshot {
  return {
    generatedAt: NOW.toISOString(),
    serviceCases: [],
    tasks: [],
    truncated: false,
  };
}

function healthyOwnerLeverage(
  overrides: Partial<OwnerLeverageSnapshot> = {},
): OwnerLeverageSnapshot {
  return {
    generatedAt: NOW.toISOString(),
    source: "supabase",
    schemaAvailable: true,
    period: {
      businessWeekStart: "2026-08-10",
      businessWeekEndExclusive: "2026-08-17",
      today: "2026-08-14",
    },
    operators: [],
    openSessions: [],
    recentSessions: [],
    metrics: emptyOwnerLeverageMetrics(),
    unreviewedCompletedVisits: 0,
    sources: {
      fieldReviews: "ready",
      growthSessions: "ready",
      signedArrAttribution: "ready",
      jobberCompletion: "ready",
    },
    warnings: [],
    ...overrides,
  };
}

function healthyTechnicianReadiness(
  overrides: Partial<TechnicianReadinessSnapshot> = {},
): TechnicianReadinessSnapshot {
  return {
    generatedAt: NOW.toISOString(),
    today: "2026-08-14",
    schemaAvailable: true,
    jobberConnected: true,
    jobberStatus: "connected",
    jobberDataFresh: true,
    lastJobberSyncAt: "2026-08-14T17:30:00.000Z",
    technicians: [],
    trials: [],
    warnings: [],
    ...overrides,
  };
}

function healthyCapacityWeek(
  overrides: Partial<TechnicianCapacityWeekDemand> = {},
): TechnicianCapacityWeekDemand {
  return {
    weekStart: "2026-08-10",
    weekEndExclusive: "2026-08-17",
    sourceAvailable: true,
    scheduledVisits: 0,
    scheduledCrewMinutes: 0,
    declaredCapacityMinutes: 1_920,
    remainingCrewMinutes: 1_920,
    unassignedStops: 0,
    unassignedMinutes: 0,
    assignmentUnknownStops: 0,
    ...overrides,
  };
}

function healthyTechnicianCapacity(
  overrides: Partial<TechnicianCapacitySnapshot> = {},
): TechnicianCapacitySnapshot {
  return {
    generatedAt: NOW.toISOString(),
    today: "2026-08-14",
    schemaAvailable: true,
    jobberConnected: true,
    jobberStatus: "connected",
    jobberDataFresh: true,
    lastJobberSyncAt: "2026-08-14T17:30:00.000Z",
    technicians: [],
    weeks: [
      healthyCapacityWeek(),
      healthyCapacityWeek({
        weekStart: "2026-08-17",
        weekEndExclusive: "2026-08-24",
      }),
      healthyCapacityWeek({
        weekStart: "2026-08-24",
        weekEndExclusive: "2026-08-31",
      }),
      healthyCapacityWeek({
        weekStart: "2026-08-31",
        weekEndExclusive: "2026-09-07",
      }),
    ],
    warnings: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<OwnerAttentionInput> = {}): OwnerAttentionInput {
  return {
    now: NOW,
    ownerSales: ready(ownerSalesSnapshot()),
    salesRetention: ready(healthySalesRetention()),
    today: ready(healthyToday()),
    ownerLeverage: ready(healthyOwnerLeverage()),
    technicianReadiness: ready(healthyTechnicianReadiness()),
    technicianCapacity: ready(healthyTechnicianCapacity()),
    billing: ready(healthyBilling()),
    communications: ready(healthyCommunications()),
    aftercare: ready(healthyAftercare()),
    referrals: ready(healthyReferrals()),
    productionHealth: ready(healthyProduction()),
    ...overrides,
  };
}

function lead(overrides: Partial<LeadIntakeRecord> = {}): LeadIntakeRecord {
  return {
    id: "lead-1",
    name: "Mandi Rivera",
    phone: "+15305550123",
    email: "mandi@example.com",
    serviceAddress: "1420 Davis Street, Chico, CA",
    servicesInterested: ["Window Cleaning"],
    preferredContactMethod: "Text",
    smsConsentStatus: "opted_in",
    smsConsentRecordedAt: "2026-08-14T10:00:00.000Z",
    notes: "",
    membershipTier: null,
    squareFootage: null,
    estimatedVisitPrice: null,
    preferredStartWindow: null,
    status: "new",
    submittedAt: "2026-08-14T10:00:00.000Z",
    source: "request_form",
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

function davidLead(overrides: Partial<SalesRepLead> = {}): SalesRepLead {
  return {
    id: "david-lead-1",
    leadIntakeId: null,
    fullName: "Jeff Mason",
    propertyAddress: "100 Main Street",
    phone: null,
    email: null,
    status: "follow_up",
    source: "door_to_door",
    serviceInterests: ["exterior_windows"],
    estimatedArrCents: 120_000,
    nextFollowUpAt: "2026-08-13T17:00:00.000Z",
    notes: "",
    smsConsentStatus: "unknown",
    emailConsentStatus: "unknown",
    closeJourney: null,
    recentInteractions: [],
    createdAt: "2026-08-12T17:00:00.000Z",
    updatedAt: "2026-08-13T17:00:00.000Z",
    ...overrides,
  };
}

function visit(overrides: Partial<JobberTodayVisit> = {}): JobberTodayVisit {
  return {
    projectionId: "projection-1",
    externalVisitId: "visit-1",
    clientName: "Joani Hall",
    title: "Quarterly windows",
    jobNumber: 101,
    visitStatus: "ACTIVE",
    jobStatus: "ACTIVE",
    scheduledStart: "2026-08-14T15:00:00.000Z",
    scheduledEnd: "2026-08-14T16:00:00.000Z",
    isComplete: true,
    assignedUsers: [{ id: "tech-1", name: "Alex" }],
    assignmentReadState: "available",
    scopeItems: [],
    scopeReadState: "available",
    propertyLabel: "Home",
    jobberPropertyWebUri: null,
    jobberClientWebUri: null,
    homeAtlasPropertyId: "property-1",
    homeAtlasAppointmentId: "appointment-1",
    homeAtlasMembershipId: "membership-1",
    homeAtlasPortalPath: "/member/token",
    homeAtlasFieldRecordCount: 1,
    homeAtlasLatestFieldRecordAt: "2026-08-14T16:00:00.000Z",
    homeAtlasLatestFieldRecordBy: "Alex",
    homeAtlasCustomerVisibleRecordCount: 1,
    homeAtlasOpenFollowUpCount: 0,
    homeAtlasFieldStage: "departed",
    homeAtlasFieldStageAt: "2026-08-14T16:00:00.000Z",
    homeAtlasFieldStageBy: "Alex",
    homeAtlasFieldEventCount: 4,
    homeAtlasIndependenceReview: null,
    ...overrides,
  };
}

function followUp(
  overrides: Partial<VisitFieldFollowUpView> = {},
): VisitFieldFollowUpView {
  return {
    assessmentId: "assessment-1",
    fieldRecordId: "record-1",
    propertyId: "property-1",
    appointmentId: "appointment-1",
    homeownerName: "Joani Hall",
    propertyName: "Home",
    propertyAddress: "100 Main Street",
    technicianName: "Alex",
    visitDate: "2026-08-13",
    customerSummary: "Customer asked about screens.",
    internalNote: null,
    dueAt: "2026-08-13T16:00:00.000Z",
    createdAt: "2026-08-13T15:00:00.000Z",
    ...overrides,
  };
}

function billingRow(overrides: Partial<BillingRegisterRow> = {}): BillingRegisterRow {
  return {
    membershipId: "membership-1",
    homeownerId: "homeowner-1",
    propertyId: "property-1",
    homeownerName: "Mandi Rivera",
    propertyLabel: "Home · 1420 Davis Street",
    tierLabel: "Quarterly",
    visitPrice: 325,
    jobberScheduledAmount: 425,
    enrollmentSavingsPerVisit: 0,
    nextAppointmentId: "appointment-1",
    nextAppointmentDate: "2026-08-20T16:00:00.000Z",
    stripePaymentStatus: "card_on_file",
    paymentSetupEmailState: "card_on_file",
    paymentSetupEmailRecipient: "mandi@example.com",
    cardOnFileLabel: "Visa •••• 0406",
    stripeCustomerId: "cus_example",
    nextChargeDate: "2026-08-20",
    lastChargeDate: null,
    billingPeriod: "2026-08",
    periodAlreadyPaid: false,
    canRecordCharge: true,
    billingStatus: "ready_to_charge",
    agreementId: "agreement-1",
    agreementPdfUrl: null,
    chargeAction: "complete_and_charge",
    automaticBillingEnabled: true,
    billingAuthorizationReady: true,
    jobberPropertyPaired: true,
    verifiedServiceVisitReady: true,
    billingOrderId: null,
    billingExecutionState: null,
    billingFailureCode: null,
    billingFailureMessage: null,
    billingAttemptCount: 0,
    billingNextAttemptAt: null,
    ...overrides,
  };
}

describe("owner attention queue", () => {
  it("stays quiet when every source is verified and no action is due", () => {
    const response = buildOwnerAttentionQueue(baseInput());

    expect(response.items).toEqual([]);
    expect(response.summary).toEqual({
      actionCount: 0,
      itemCount: 0,
      criticalCount: 0,
      highCount: 0,
      normalCount: 0,
      degradedSourceCount: 0,
    });
    expect(response.sources.every((source) => source.state === "ready")).toBe(true);
  });

  it("ranks overdue customer, field, and billing evidence ahead of setup work", () => {
    const todayVisit = visit({
      isComplete: false,
      homeAtlasFieldStage: "departed",
      homeAtlasFieldRecordCount: 0,
      homeAtlasCustomerVisibleRecordCount: 0,
    });
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({ unassignedInbound: [lead()] }),
        ),
        today: ready(
          healthyToday({
            connected: false,
            connectionStatus: "disconnected",
            visits: [todayVisit],
            fieldFollowUps: [followUp()],
            summary: {
              ...healthyToday().summary,
              total: 1,
              remaining: 1,
              jobberCompletionPending: 1,
            },
          }),
        ),
        billing: ready(
          healthyBilling({
            rows: [
              billingRow({
                billingStatus: "failed",
                billingExecutionState: "reconciliation_required",
                billingFailureCode: "provider_state_unknown",
                billingAttemptCount: 2,
              }),
            ],
          }),
        ),
        communications: ready({
          ...healthyCommunications(),
          twilio: launchCard("twilio", "needs_action"),
        }),
      }),
    );

    expect(response.items.slice(0, 5).every((item) => item.priority === "critical")).toBe(true);
    expect(response.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "lead:lead-1",
        "today:jobber-disconnected",
        "today:departed-jobber-open",
        "field-follow-up:assessment-1",
        "billing:membership-1",
        "communications:twilio",
      ]),
    );
    expect(response.summary.criticalCount).toBeGreaterThanOrEqual(5);
  });

  it("links exact operational exceptions to their actionable record", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({ unassignedInbound: [lead()] }),
        ),
        today: ready(
          healthyToday({
            visits: [visit({ isComplete: true, homeAtlasFieldRecordCount: 0 })],
            fieldFollowUps: [followUp()],
          }),
        ),
        billing: ready(healthyBilling({ rows: [billingRow()] })),
      }),
    );

    expect(response.items.find((item) => item.id === "lead:lead-1")?.href).toBe(
      "/hq/requests/lead-1",
    );
    expect(
      response.items.find((item) => item.id === "field-follow-up:assessment-1")
        ?.href,
    ).toBe("/hq/today#field-follow-up-assessment-1");
    expect(
      response.items.find((item) => item.id === "today:completed-without-proof")
        ?.href,
    ).toBe("/hq/today#visit-projection-1");
    expect(response.items.find((item) => item.id === "billing:ready")?.href).toBe(
      "/hq/billing#billing-membership-1",
    );
  });

  it("turns every rep's follow-up timing into read-only owner actions", () => {
    const noahLead = davidLead({
      id: "noah-lead-1",
      fullName: "Joani Cole",
      nextFollowUpAt: "2026-08-14T19:00:00.000Z",
      estimatedArrCents: 90_000,
    });
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({
            leads: [
              salesLeadSource("david", davidLead()),
              salesLeadSource("noah", noahLead),
            ],
          }),
        ),
      }),
    );
    const item = response.items.find(
      (candidate) => candidate.id === "sales-lead:david-lead-1",
    );
    const noahItem = response.items.find(
      (candidate) => candidate.id === "sales-lead:noah-lead-1",
    );

    expect(item).toMatchObject({
      priority: "critical",
      title: "David: Jeff Mason",
      href: "/hq/sales#owner-sales-lead-david-lead-1",
      affectedCount: 1,
    });
    expect(item?.detail).toContain("$1,200 potential ARR");
    expect(noahItem).toMatchObject({
      priority: "high",
      title: "Noah Thomas: Joani Cole",
      sourceLabel: "Noah Thomas pipeline",
      href: "/hq/sales#owner-sales-lead-noah-lead-1",
    });
  });

  it("does not duplicate an assigned intake in the unassigned lead queue", () => {
    const assignedLead = davidLead({
      id: "assigned-lead-1",
      leadIntakeId: "lead-1",
    });
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({
            unassignedInbound: [],
            leads: [salesLeadSource("noah", assignedLead)],
          }),
        ),
      }),
    );

    expect(
      response.items.filter((item) => item.id === "sales-lead:assigned-lead-1"),
    ).toHaveLength(1);
    expect(response.items.some((item) => item.id === "lead:lead-1")).toBe(false);
  });

  it("keeps partial owner-sales reads explicit instead of treating them as clear", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({
            unassignedInbound: null,
            handoffs: null,
          }),
        ),
      }),
    );

    expect(response.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "owner-sales:inbound-unknown",
        "owner-sales:handoffs-unknown",
      ]),
    );
  });

  it("surfaces unreviewed field time and stale Growth Sessions", () => {
    const baseMetrics = emptyOwnerLeverageMetrics();
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerLeverage: ready(
          healthyOwnerLeverage({
            unreviewedCompletedVisits: 2,
            openSessions: [
              {
                id: "growth-session-1",
                operatorId: "operator-1",
                operatorSlug: "noah",
                operatorName: "Noah Thomas",
                businessDate: "2026-08-13",
                channel: "door_to_door",
                status: "open",
                startedAt: "2026-08-13T23:00:00.000Z",
                endedAt: null,
                breakMinutes: 0,
                notes: null,
              },
            ],
            metrics: {
              ...baseMetrics,
              dedicatedGrowthDays: 1,
              newArrPerDedicatedGrowthDay: 250,
              growthDayBand: "below_floor",
            },
          }),
        ),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === "owner-leverage:unreviewed-visits",
      ),
    ).toMatchObject({
      priority: "high",
      affectedCount: 2,
      href: "/hq/today",
    });
    expect(
      response.items.find(
        (item) => item.id === "owner-leverage:open-session:growth-session-1",
      ),
    ).toMatchObject({
      priority: "critical",
      actionLabel: "Cancel stale session",
      href: "/hq/growth",
    });
    expect(
      response.items.find(
        (item) => item.id === "owner-leverage:growth-day-below-floor",
      )?.detail,
    ).toContain("$250 signed ARR");
  });

  it("routes failed independent-day evidence into owner attention", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        technicianReadiness: ready(
          healthyTechnicianReadiness({
            trials: [
              {
                id: "trial-1",
                jobberUserId: "jarad-jobber-id",
                displayName: "Jarad",
                trialDate: "2026-08-13",
                status: "planned",
                planNote: null,
                plannedBy: "HomeAtlas HQ",
                plannedAt: "2026-08-12T18:00:00.000Z",
                cancelledAt: null,
                cancelledBy: null,
                cancellationReason: null,
                outcome: "did_not_verify",
                scheduledStops: 4,
                completedStops: 4,
                reviewedStops: 4,
                qualifyingIndependentStops: 3,
              },
            ],
          }),
        ),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === "technician-readiness:trial:trial-1",
      ),
    ).toMatchObject({
      priority: "critical",
      href: "/hq/technicians",
      actionLabel: "Open readiness file",
    });
  });

  it("routes exact technician overload and unassigned work into owner attention", () => {
    const capacity = healthyTechnicianCapacity();
    const jaradWeek: TechnicianCapacityWeekForecast = {
      weekStart: "2026-08-10",
      weekEndExclusive: "2026-08-17",
      plan: null,
      state: "ready",
      scheduledStops: 7,
      scheduledMinutes: 2_100,
      capacityMinutes: 1_920,
      remainingMinutes: -180,
      utilizationPercent: 109.375,
      planningLaborCostCents: null,
      overCapacity: true,
      detail: "180 scheduled minutes exceed declared capacity.",
    };
    const response = buildOwnerAttentionQueue(
      baseInput({
        technicianCapacity: ready({
          ...capacity,
          technicians: [
            {
              jobberUserId: "jarad-jobber-id",
              displayName: "Jarad",
              mirroredRosterActive: true,
              weeks: [jaradWeek],
            },
          ],
          weeks: [
            healthyCapacityWeek({
              scheduledVisits: 8,
              scheduledCrewMinutes: 2_220,
              declaredCapacityMinutes: 1_920,
              remainingCrewMinutes: -300,
              unassignedStops: 1,
              unassignedMinutes: 120,
            }),
          ],
        }),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === "technician-capacity:over:2026-08-10",
      ),
    ).toMatchObject({
      priority: "critical",
      href: "/hq/technicians",
      actionLabel: "Resolve field capacity",
    });
    expect(
      response.items.find(
        (item) => item.id === "technician-capacity:unassigned:2026-08-10",
      ),
    ).toMatchObject({ priority: "high", affectedCount: 1 });
  });

  it("asks for explicit plans instead of treating undeclared hours as open", () => {
    const capacity = healthyTechnicianCapacity();
    const response = buildOwnerAttentionQueue(
      baseInput({
        technicianCapacity: ready({
          ...capacity,
          technicians: [
            {
              jobberUserId: "jarad-jobber-id",
              displayName: "Jarad",
              mirroredRosterActive: true,
              weeks: [
                {
                  weekStart: "2026-08-10",
                  weekEndExclusive: "2026-08-17",
                  plan: null,
                  state: "no_plan",
                  scheduledStops: 3,
                  scheduledMinutes: 360,
                  capacityMinutes: null,
                  remainingMinutes: null,
                  utilizationPercent: null,
                  planningLaborCostCents: null,
                  overCapacity: false,
                  detail: "Capacity is not declared.",
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === "technician-capacity:missing-plans",
      ),
    ).toMatchObject({ priority: "normal", affectedCount: 1 });
  });

  it("surfaces referral rewards and old pending referral leads", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        referrals: ready({
          generatedAt: NOW.toISOString(),
          truncated: false,
          members: [
            {
              membershipId: "membership-1",
              memberName: "Mandi Rivera",
              code: "SKMINTY",
              pendingReferralCount: 2,
              oldestPendingAt: "2026-08-01T18:00:00.000Z",
              convertedUnrewardedCount: 1,
              oldestConvertedAt: "2026-08-10T18:00:00.000Z",
              availableRewardCount: 1,
              availableCareCreditCents: 2_500,
            },
          ],
        }),
      }),
    );

    expect(response.items.find((item) => item.id === "referral-reward:membership-1"))
      .toMatchObject({
        priority: "high",
        href: "/hq/referrals#referral-member-membership-1",
        affectedCount: 1,
      });
    expect(response.items.find((item) => item.id === "referral-pending:membership-1"))
      .toMatchObject({ priority: "normal", affectedCount: 2 });
  });

  it("surfaces overdue and cancelled salesperson retention drift", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        salesRetention: ready({
          generatedAt: NOW.toISOString(),
          truncated: false,
          records: [
            {
              attributionId: "attribution-due",
              membershipId: "membership-due",
              repSlug: "david",
              repDisplayName: "David",
              homeownerName: "Jeff Mason",
              membershipStatus: "active",
              qualificationStatus: "active",
              retentionQualifiesAt: "2026-08-12T18:00:00.000Z",
            },
            {
              attributionId: "attribution-cancelled",
              membershipId: "membership-cancelled",
              repSlug: "david",
              repDisplayName: "David",
              homeownerName: "Joani Hall",
              membershipStatus: "cancelled",
              qualificationStatus: "active",
              retentionQualifiesAt: "2026-09-01T18:00:00.000Z",
            },
          ],
        }),
      }),
    );

    expect(response.items.find((item) => item.id === "sales-retention:attribution-due"))
      .toMatchObject({
        priority: "critical",
        href: "/hq/customers/membership/membership-due",
      });
    expect(
      response.items.find(
        (item) => item.id === "sales-retention:attribution-cancelled",
      ),
    ).toMatchObject({
      priority: "critical",
      href: "/hq/customers/membership/membership-cancelled",
    });
  });

  it("routes signed-member production gaps without calling stale Jobber data unscheduled", () => {
    const paymentNeeded = deriveSalesProductionHandoff({
      attributionId: "attribution-payment",
      membershipId: "membership-payment",
      homeownerName: "Mandi Rivera",
      propertyAddress: "88 Oak Way",
      attributedArrCents: 120_000,
      attributedAt: "2026-08-14T17:00:00.000Z",
      membership: {
        id: "membership-payment",
        homeowner_id: "homeowner-1",
        property_id: "property-1",
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: null,
        stripe_customer_id: null,
        agreement_id: "agreement-1",
        presentation_id: "presentation-1",
        sales_tier: "quarterly",
        visit_price: 300,
        visits_per_year: 4,
      },
      paymentSetupEmailState: "ready",
      paymentHandoffProgress: {
        state: "not_started",
        canSend: true,
        emailSentAt: null,
        expiresAt: null,
      },
      propertyLinked: false,
      recurringJobCount: 0,
      scheduleSourceState: "unavailable",
      scheduleObservedAt: null,
      nextScheduledAt: null,
    });
    const scheduleUnknown = {
      ...paymentNeeded,
      attributionId: "attribution-unknown",
      membershipId: "membership-unknown",
      homeownerName: "Jeff Mason",
      stage: "source_unavailable" as const,
      label: "Schedule unverified",
      detail: "Current Jobber schedule truth is unavailable.",
      completedSteps: 4,
      actionLabel: "Restore Jobber truth",
      actionHref: "/hq/jobber",
    };
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({
            handoffs: [paymentNeeded, scheduleUnknown].map((handoff) =>
              salesHandoffSource("david", handoff),
            ),
          }),
        ),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === "sales-handoff:attribution-payment",
      ),
    ).toMatchObject({
      priority: "critical",
      domain: "billing",
      href: "/presentations/presentation-1/present",
    });
    const unknownItem = response.items.find(
      (item) => item.id === "sales-handoff:schedule-source",
    );
    expect(unknownItem).toMatchObject({
      priority: "high",
      affectedCount: 1,
      href: "/hq/jobber",
    });
    expect(unknownItem?.detail).toContain("not calling them unscheduled");
  });

  it("does not turn an active customer card link into duplicate owner work", () => {
    const waiting = deriveSalesProductionHandoff({
      attributionId: "attribution-waiting",
      membershipId: "membership-waiting",
      homeownerName: "Joani Cole",
      propertyAddress: "90 Oak Way",
      attributedArrCents: 90_000,
      attributedAt: "2026-08-16T17:00:00.000Z",
      membership: {
        id: "membership-waiting",
        homeowner_id: "homeowner-waiting",
        property_id: "property-waiting",
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: null,
        stripe_customer_id: "customer-waiting",
        agreement_id: "agreement-waiting",
        presentation_id: "presentation-waiting",
        sales_tier: "biannual",
        visit_price: 250,
        visits_per_year: 2,
      },
      paymentSetupEmailState: "ready",
      paymentHandoffProgress: {
        state: "email_sent",
        canSend: false,
        emailSentAt: "2026-08-16T17:05:00.000Z",
        expiresAt: "2026-08-17T17:05:00.000Z",
      },
      propertyLinked: false,
      recurringJobCount: 0,
      scheduleSourceState: "unavailable",
      scheduleObservedAt: null,
      nextScheduledAt: null,
    });
    const response = buildOwnerAttentionQueue(
      baseInput({
        ownerSales: ready(
          ownerSalesSnapshot({
            handoffs: [salesHandoffSource("david", waiting)],
          }),
        ),
      }),
    );

    expect(waiting.stage).toBe("payment_pending");
    expect(
      response.items.some(
        (item) => item.id === "sales-handoff:attribution-waiting",
      ),
    ).toBe(false);
  });

  it("surfaces verified review moments and overdue annual care check-ins", () => {
    const reviewAppointmentId = "11111111-1111-4111-8111-111111111111";
    const membershipId = "22222222-2222-4222-8222-222222222222";
    const response = buildOwnerAttentionQueue(
      baseInput({
        aftercare: ready({
          generatedAt: NOW.toISOString(),
          truncated: false,
          serviceCases: [],
          tasks: [
            {
              taskKey: `review-opportunity:${reviewAppointmentId}`,
              type: "review_opportunity",
              homeownerId: "33333333-3333-4333-8333-333333333333",
              propertyId: "44444444-4444-4444-8444-444444444444",
              membershipId,
              appointmentId: reviewAppointmentId,
              homeownerName: "Mandi Rivera",
              propertyLabel: "Davis Street Residence",
              dueAt: "2026-08-10T18:00:00.000Z",
              evidenceAt: "2026-08-09T18:00:00.000Z",
              serviceLabel: "Exterior Window Cleaning",
              completedAt: "2026-08-09T18:00:00.000Z",
              customerSummaryVisible: true,
              customerPhotoVisible: true,
            },
            {
              taskKey: `annual-care-checkin:${membershipId}:2026`,
              type: "annual_care_checkin",
              homeownerId: "33333333-3333-4333-8333-333333333333",
              propertyId: "44444444-4444-4444-8444-444444444444",
              membershipId,
              appointmentId: null,
              homeownerName: "Mandi Rivera",
              propertyLabel: "Davis Street Residence",
              dueAt: "2026-07-20T16:00:00.000Z",
              evidenceAt: "2025-07-20T16:00:00.000Z",
              membershipStartedAt: "2025-07-20T16:00:00.000Z",
              anniversaryNumber: 1,
            },
          ],
        }),
      }),
    );

    expect(
      response.items.find(
        (item) => item.id === `aftercare:review-opportunity:${reviewAppointmentId}`,
      ),
    ).toMatchObject({
      priority: "normal",
      href: `/hq/aftercare#aftercare-task-review-opportunity-${reviewAppointmentId}`,
    });
    expect(
      response.items.find(
        (item) => item.id === `aftercare:annual-care-checkin:${membershipId}:2026`,
      ),
    ).toMatchObject({ priority: "high", actionLabel: "Open care moment" });
  });

  it("puts customer-reported service cases directly in the owner queue", () => {
    const caseId = "55555555-5555-4555-8555-555555555555";
    const response = buildOwnerAttentionQueue(
      baseInput({
        aftercare: ready({
          generatedAt: NOW.toISOString(),
          truncated: false,
          tasks: [],
          serviceCases: [
            {
              id: caseId,
              membershipId: "11111111-1111-4111-8111-111111111111",
              homeownerId: "22222222-2222-4222-8222-222222222222",
              propertyId: "33333333-3333-4333-8333-333333333333",
              appointmentId: null,
              homeownerName: "Mandi Rivera",
              propertyLabel: "Davis Street Residence",
              category: "damage_concern",
              details: "A customer reported a possible screen-frame scratch.",
              status: "open",
              ownerNote: null,
              acknowledgedAt: null,
              resolvedAt: null,
              createdAt: "2026-08-14T17:30:00.000Z",
              updatedAt: "2026-08-14T17:30:00.000Z",
            },
          ],
        }),
      }),
    );

    expect(
      response.items.find((item) => item.id === `service-case:${caseId}`),
    ).toMatchObject({
      priority: "critical",
      domain: "field",
      href: `/hq/aftercare#service-case-${caseId}`,
      actionLabel: "Open customer case",
    });
  });

  it("fails closed when a source cannot be read", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        billing: {
          state: "degraded",
          detail: "Atlas could not verify the billing register.",
        },
      }),
    );

    expect(response.summary.degradedSourceCount).toBe(1);
    expect(response.items[0]).toMatchObject({
      id: "source:billing",
      priority: "critical",
      href: "/hq/billing",
    });
    expect(response.items[0].detail).toContain("unknown, not healthy");
  });

  it("surfaces uncovered production checks without duplicating provider readiness", () => {
    const response = buildOwnerAttentionQueue(
      baseInput({
        productionHealth: ready({
          onboardingSafe: "red",
          summary: "Blocked.",
          checkedAt: NOW.toISOString(),
          sections: [
            {
              id: "schema",
              title: "Schema",
              status: "red",
              checks: [
                {
                  id: "field-record-media-schema",
                  label: "Field media schema",
                  status: "red",
                  message: "Migration missing",
                },
                {
                  id: "sms-provider",
                  label: "SMS provider",
                  status: "yellow",
                  message: "Not ready",
                },
              ],
            },
          ],
        }),
      }),
    );
    const item = response.items.find(
      (candidate) => candidate.id === "production-health:uncovered",
    );

    expect(item).toMatchObject({ affectedCount: 1, priority: "critical" });
    expect(item?.detail).toContain("Field media schema");
    expect(item?.detail).not.toContain("SMS provider");
  });

  it("keeps the owner snapshot loader free of reconciliation writes", () => {
    const source = readFileSync(
      new URL("../sales/workspace-server.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf(
      "export async function loadSalesLeadAttentionSnapshot",
    );
    const end = source.indexOf("export async function createSalesLead", start);
    const loader = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(loader).toContain("loadAllOpenSalesRepLeadRows");
    expect(loader).not.toContain("reconcileSignedMembershipAttributionsForRep");
  });

  it("keeps referral and retention attention loaders read-only", () => {
    const referralSource = readFileSync(
      new URL("../referrals/attention-server.ts", import.meta.url),
      "utf8",
    );
    expect(referralSource).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
    expect(referralSource).not.toContain("loadMemberReferralRewards");

    const lifecycleSource = readFileSync(
      new URL("../sales/attribution-lifecycle-server.ts", import.meta.url),
      "utf8",
    );
    const start = lifecycleSource.indexOf(
      "export async function loadSalesRetentionAttentionSnapshot",
    );
    const end = lifecycleSource.indexOf(
      "export async function syncMembershipSalesAttributionLifecycle",
      start,
    );
    const loader = lifecycleSource.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(loader).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);

    const aftercareSource = readFileSync(
      new URL("../aftercare/customer-aftercare-server.ts", import.meta.url),
      "utf8",
    );
    expect(aftercareSource).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
    const ownerServerSource = readFileSync(
      new URL("./owner-attention-server.ts", import.meta.url),
      "utf8",
    );
    expect(ownerServerSource).toContain("loadCustomerAftercareSnapshot");
    expect(ownerServerSource).toContain("loadOwnerSalesAttentionSnapshot");
    expect(ownerServerSource).not.toContain("listLeadIntakes");
    expect(ownerServerSource).not.toContain("DAVID_REP_PROFILE");
    expect(ownerServerSource).not.toContain("loadSalesLeadAttentionSnapshot(");
    expect(ownerServerSource).not.toContain(
      "loadSalesProductionHandoffAttentionSnapshot",
    );
    expect(ownerServerSource).not.toContain("customer-aftercare-actions-server");
  });
});
