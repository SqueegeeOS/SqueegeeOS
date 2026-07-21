import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  client: { from: vi.fn() },
  loadMembershipPortalRow: vi.fn(),
  loadMemberSavingsLedgerView: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => mocks.client),
  isSupabaseConfigured: mocks.configured,
  isServiceRoleConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/persistence/queries/load-membership-portal-row", () => ({
  loadMembershipPortalRow: mocks.loadMembershipPortalRow,
}));

vi.mock("@/lib/membership/member-savings-ledger-server", () => ({
  loadMemberSavingsLedgerView: mocks.loadMemberSavingsLedgerView,
}));

vi.mock("@/lib/agreement/signed-agreement-storage", () => ({
  resolveAgreementPdfAccessUrl: vi.fn(),
}));

vi.mock("@/lib/membership/resolve-portal-payment-method", () => ({
  resolvePortalPaymentMethodLabel: vi.fn(),
}));

import { getMemberPortalDataByAccess } from "./member-portal";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import { buildPortalCareRecordView } from "@/lib/membership/portal-view-model";

interface QueryResponse {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(response: QueryResponse) {
  const query: Record<string, ReturnType<typeof vi.fn>> & {
    then?: Promise<QueryResponse>["then"];
  } = {};
  for (const method of ["select", "eq", "in", "not", "order", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => response);
  query.then = (onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected);
  return query;
}

const access = {
  membershipId: "membership-1",
  homeownerId: "homeowner-1",
  propertyId: "property-1",
  memberName: "Alex Kim",
  homeownerSlug: "alex-kim",
  propertySlug: "oak-house",
  portalAccessToken: "opaque-token",
};

const sourceHash = "a".repeat(64);
const completedAt = "2026-07-19T18:30:00.000Z";
const sourceObservedAt = "2026-07-19T18:35:00.000Z";
const propertyLinkUpdatedAt = "2026-07-18T15:00:00.000Z";

const exactCompletionEvidence = {
  appointment_id: "appointment-completed",
  classification_id: "classification-1",
  projection_id: "projection-1",
  connection_id: "squeegeeking",
  external_visit_id: "jobber-visit-1",
  source_payload_hash: sourceHash,
  source_observed_at: sourceObservedAt,
  property_link_id: "property-link-1",
  property_link_updated_at: propertyLinkUpdatedAt,
  membership_id: access.membershipId,
  property_id: access.propertyId,
  provider_visit_status: "COMPLETED",
  provider_is_complete: true,
  provider_completed_at: completedAt,
};

const completedAppointment = {
  id: "appointment-completed",
  member_profile_id: "profile-1",
  property_id: access.propertyId,
  service_type: "Exterior Window Care",
  scheduled_at: "2026-07-19T16:00:00.000Z",
  status: "completed",
  technician_name: "Assigned care team",
  notes: null,
  completed_at: completedAt,
  provider: "jobber",
  external_id: "jobber-visit-1",
  source_payload_hash: sourceHash,
  source_observed_at: sourceObservedAt,
  jobber_visit_classification_id: "classification-1",
  jobber_projection_id: "projection-1",
  jobber_connection_id: "squeegeeking",
  jobber_property_link_id: "property-link-1",
  jobber_property_link_updated_at: propertyLinkUpdatedAt,
  jobber_membership_id: access.membershipId,
  jobber_authority_state: "completed",
  completion_evidence: exactCompletionEvidence,
};

const approvedAppointment = {
  ...completedAppointment,
  id: "appointment-scheduled",
  external_id: "jobber-visit-2",
  scheduled_at: "2026-08-19T16:00:00.000Z",
  status: "scheduled",
  completed_at: null,
  jobber_authority_state: "approved",
  completion_evidence: null,
};

function configurePortalQueries(input: {
  scheduledRows?: unknown[];
  completedRows?: unknown[];
  completedError?: unknown;
}) {
  const scheduledAppointmentQuery = createQueryBuilder({
    data: input.scheduledRows ?? [],
    error: null,
  });
  const completedAppointmentQuery = createQueryBuilder({
    data: input.completedRows ?? [],
    error: input.completedError ?? null,
  });
  const queries = {
    homeowners: createQueryBuilder({
      data: {
        id: access.homeownerId,
        slug: access.homeownerSlug,
        full_name: "Alex Kim",
        first_name: "Alex",
        email: "alex@example.com",
        phone: null,
      },
      error: null,
    }),
    properties: createQueryBuilder({
      data: {
        id: access.propertyId,
        homeowner_id: access.homeownerId,
        slug: access.propertySlug,
        name: "Oak House",
        address: "1 Oak Way",
        city: "Chico",
        state: "CA",
        zip: "95928",
        square_feet: null,
        zillow_url: null,
        property_details: null,
      },
      error: null,
    }),
    member_profiles: createQueryBuilder({ data: null, error: null }),
    signed_agreements: createQueryBuilder({ data: null, error: null }),
    service_observations: createQueryBuilder({ data: [], error: null }),
    member_addon_transactions: createQueryBuilder({ data: [], error: null }),
  };

  let appointmentQueryIndex = 0;
  mocks.client.from.mockImplementation(
    (table: keyof typeof queries | "member_appointments") => {
      if (table === "member_appointments") {
        return appointmentQueryIndex++ === 0
          ? scheduledAppointmentQuery
          : completedAppointmentQuery;
      }
      const query = queries[table];
      if (!query) throw new Error(`Unexpected table: ${table}`);
      return query;
    },
  );

  return { scheduledAppointmentQuery, completedAppointmentQuery };
}

describe("member portal completed Jobber history authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.loadMembershipPortalRow.mockResolvedValue({
      id: access.membershipId,
      homeowner_id: access.homeownerId,
      property_id: access.propertyId,
      plan_name: "Quarterly Care",
      price_display: "$200",
      started_at: "2026-01-01T00:00:00.000Z",
      status: "active",
      founding_member: false,
      founding_member_since: null,
      sales_tier: "quarterly",
      visit_price: 200,
      visits_per_year: 4,
      payment_setup_completed_at: null,
      presentation_id: null,
      stripe_payment_method_id: null,
      agreement_id: null,
      membership_enrollment_savings: 100,
      portal_theme: null,
    });
    mocks.loadMemberSavingsLedgerView.mockResolvedValue(null);
  });

  it("returns approved scheduled visits and only exactly evidenced completed visits", async () => {
    const mismatches = [
      { appointment_id: "appointment-other" },
      { membership_id: "membership-other" },
      { property_id: "property-other" },
      { external_visit_id: "jobber-visit-other" },
      { source_payload_hash: "b".repeat(64) },
      { source_observed_at: "2026-07-19T18:36:00.000Z" },
      { classification_id: "classification-other" },
      { projection_id: "projection-other" },
      { connection_id: "connection-other" },
      { property_link_id: "property-link-other" },
      { property_link_updated_at: "2026-07-18T15:01:00.000Z" },
      { provider_completed_at: "2026-07-19T18:31:00.000Z" },
      { provider_visit_status: "ACTIVE" },
      { provider_is_complete: false },
    ].map((evidencePatch, index) => ({
      ...completedAppointment,
      id: `appointment-mismatch-${index}`,
      completion_evidence: {
        ...exactCompletionEvidence,
        appointment_id: `appointment-mismatch-${index}`,
        ...evidencePatch,
      },
    }));

    const unqualifiedRows = [
      {
        ...completedAppointment,
        id: "appointment-no-evidence",
        completion_evidence: null,
      },
      {
        ...approvedAppointment,
        id: "appointment-not-approved",
        jobber_authority_state: "completed",
      },
      {
        ...approvedAppointment,
        id: "appointment-approved-with-completion",
        completion_evidence: {
          ...exactCompletionEvidence,
          appointment_id: "appointment-approved-with-completion",
        },
      },
    ];

    const { scheduledAppointmentQuery, completedAppointmentQuery } =
      configurePortalQueries({
        scheduledRows: [approvedAppointment, ...unqualifiedRows],
        completedRows: [completedAppointment, ...mismatches, ...unqualifiedRows],
      });

    const result = await getMemberPortalDataByAccess(access);

    expect(result?.appointments).toEqual([
      {
        id: completedAppointment.id,
        date: completedAppointment.scheduled_at,
        serviceType: completedAppointment.service_type,
        technician: completedAppointment.technician_name,
        notes: null,
        status: "completed",
        countsTowardMembershipSavings: false,
      },
      {
        id: approvedAppointment.id,
        date: approvedAppointment.scheduled_at,
        serviceType: approvedAppointment.service_type,
        technician: approvedAppointment.technician_name,
        notes: null,
        status: "scheduled",
      },
    ]);
    expect(result?.nextAppointment?.id).toBe(approvedAppointment.id);

    expect(scheduledAppointmentQuery.eq).toHaveBeenCalledWith(
      "provider",
      "jobber",
    );
    expect(scheduledAppointmentQuery.eq).toHaveBeenCalledWith(
      "verification_state",
      "verified",
    );
    expect(scheduledAppointmentQuery.eq).toHaveBeenCalledWith(
      "match_state",
      "matched",
    );
    expect(scheduledAppointmentQuery.eq).toHaveBeenCalledWith(
      "jobber_membership_id",
      access.membershipId,
    );
    expect(scheduledAppointmentQuery.eq).toHaveBeenCalledWith(
      "jobber_authority_state",
      "approved",
    );
    expect(completedAppointmentQuery.eq).toHaveBeenCalledWith(
      "jobber_authority_state",
      "completed",
    );

    const scheduledSelect = scheduledAppointmentQuery.select.mock
      .calls[0]?.[0] as string;
    const completedSelect = completedAppointmentQuery.select.mock
      .calls[0]?.[0] as string;
    expect(scheduledSelect).not.toContain("jobber_visit_completion_events");
    expect(completedSelect).toContain(
      "completion_evidence:jobber_visit_completion_events",
    );
    expect(completedSelect).not.toContain("visit_text_evidence");
    expect(completedSelect).not.toMatch(/evidence_text|actor_id|reason|snapshot/);
    expect(mocks.loadMemberSavingsLedgerView).toHaveBeenCalledWith(
      expect.objectContaining({
        appointments: [
          expect.objectContaining({
            id: approvedAppointment.id,
            status: "scheduled",
          }),
        ],
      }),
    );

    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, result);
    expect(view.timelineEntries.map((entry) => entry.id)).toEqual([
      completedAppointment.id,
    ]);
    expect(view.completedVisitCount).toBe(1);
    expect(view.membershipSavingsTotal).toBe(0);
    expect(view.savingsLedger.membershipVisits.lines).toEqual([]);
    expect(view.savingsLedger.totalServiceSavings).toBe(0);
    expect(view.showSavings).toBe(false);
  });

  it("keeps approved scheduled visits when completion evidence is unavailable", async () => {
    configurePortalQueries({
      scheduledRows: [approvedAppointment],
      completedError: {
        code: "PGRST200",
        message: "relationship not found in schema cache",
      },
    });

    const result = await getMemberPortalDataByAccess(access);

    expect(result?.appointments).toEqual([
      {
        id: approvedAppointment.id,
        date: approvedAppointment.scheduled_at,
        serviceType: approvedAppointment.service_type,
        technician: approvedAppointment.technician_name,
        notes: null,
        status: "scheduled",
      },
    ]);
    expect(result?.nextAppointment?.id).toBe(approvedAppointment.id);
  });

  it("lets exact completion evidence supersede a stale scheduled snapshot by id", async () => {
    const staleScheduledSnapshot = {
      ...completedAppointment,
      status: "scheduled",
      completed_at: null,
      jobber_authority_state: "approved",
      completion_evidence: null,
    };

    configurePortalQueries({
      scheduledRows: [staleScheduledSnapshot],
      completedRows: [completedAppointment],
    });

    const result = await getMemberPortalDataByAccess(access);
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, result);

    expect(result?.appointments).toEqual([
      expect.objectContaining({
        id: completedAppointment.id,
        status: "completed",
        countsTowardMembershipSavings: false,
      }),
    ]);
    expect(result?.nextAppointment).toBeNull();
    expect(view.timelineEntries.map((entry) => entry.id)).toEqual([
      completedAppointment.id,
    ]);
    expect(view.membershipSavingsTotal).toBe(0);
    expect(view.savingsLedger.totalServiceSavings).toBe(0);
  });

  it("does not let malformed completion evidence displace a scheduled visit", async () => {
    const staleScheduledSnapshot = {
      ...completedAppointment,
      status: "scheduled",
      completed_at: null,
      jobber_authority_state: "approved",
      completion_evidence: null,
    };
    const malformedCompletedSnapshot = {
      ...completedAppointment,
      completion_evidence: {
        ...exactCompletionEvidence,
        source_payload_hash: "b".repeat(64),
      },
    };

    configurePortalQueries({
      scheduledRows: [staleScheduledSnapshot],
      completedRows: [malformedCompletedSnapshot],
    });

    const result = await getMemberPortalDataByAccess(access);

    expect(result?.appointments).toEqual([
      expect.objectContaining({
        id: completedAppointment.id,
        status: "scheduled",
      }),
    ]);
    expect(result?.nextAppointment?.id).toBe(completedAppointment.id);
  });

  it("accepts the unique reverse relationship array shape only when it has one event", async () => {
    configurePortalQueries({
      completedRows: [
        {
          ...completedAppointment,
          completion_evidence: [exactCompletionEvidence],
        },
        {
          ...completedAppointment,
          id: "appointment-ambiguous-evidence",
          completion_evidence: [
            {
              ...exactCompletionEvidence,
              appointment_id: "appointment-ambiguous-evidence",
            },
            {
              ...exactCompletionEvidence,
              appointment_id: "appointment-ambiguous-evidence",
            },
          ],
        },
      ],
    });

    const result = await getMemberPortalDataByAccess(access);

    expect(result?.appointments.map((appointment) => appointment.id)).toEqual([
      completedAppointment.id,
    ]);
  });
});
