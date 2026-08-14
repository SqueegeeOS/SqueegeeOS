import { afterEach, describe, expect, it, vi } from "vitest";

const EXISTING_APPOINTMENT = {
  id: "appt-existing-1",
  member_profile_id: null,
  property_id: "property-1",
  service_type: "window_cleaning",
  scheduled_at: "2099-08-15T14:00:00.000Z",
  status: "scheduled",
  technician_name: "Noah",
  notes: null,
  completed_at: null,
  provider: "jobber",
  external_id: "visit-1",
  provenance_state: "provider_imported",
  verification_state: "verified",
  match_state: "matched",
};

const insertSpy = vi.fn();
const upsertSpy = vi.fn();
let appointmentRowsFixture = [EXISTING_APPOINTMENT];
let propertyLinkFixture: {
  connection_id: string;
  external_property_id: string;
} | null = null;
let jobberVisitFixture: {
  external_visit_id: string;
  scheduled_start: string;
  title: string | null;
} | null = null;
let assessmentNoteFixture: Array<{
  id: string;
  field_record_id: string | null;
  technician_name: string;
  customer_note: string;
  visit_date: string;
}> = [];
let propertyAssetFixture: Array<{
  id: string;
  field_record_id: string | null;
  storage_bucket: string;
  storage_path: string;
  title: string;
  description: string | null;
  capture_type: "before" | "after" | "detail";
  captured_by: string | null;
  is_primary: boolean;
  captured_at: string;
  created_at: string;
}> = [];
const createSignedUrlSpy = vi.fn(async (path: string) => ({
  data: { signedUrl: `https://storage.example.test/signed/${path}` },
  error: null,
}));

function chain(result: { data?: unknown; error?: unknown; count?: number }) {
  const promise = Promise.resolve(result);
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "in",
    "gte",
    "neq",
    "not",
    "order",
    "limit",
    "update",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => promise);
  builder.insert = vi.fn(() => {
    insertSpy();
    return promise;
  });
  builder.upsert = vi.fn(() => {
    upsertSpy();
    return promise;
  });
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => promise.then(onfulfilled, onrejected);
  builder.catch = (onrejected?: ((reason: unknown) => unknown) | null) =>
    promise.catch(onrejected);
  return builder;
}

function mockSupabaseFrom(table: string) {
  switch (table) {
    case "homeowners":
      return chain({
        data: {
          id: "homeowner-1",
          slug: "sylvia-siegel",
          full_name: "Sylvia Siegel",
          first_name: "Sylvia",
          email: null,
          phone: null,
        },
      });
    case "properties":
      return chain({
        data: {
          id: "property-1",
          homeowner_id: "homeowner-1",
          slug: "chico-estate",
          name: "Chico Estate",
          address: "123 Main St",
          city: "Chico",
          state: "CA",
          zip: "95926",
          square_feet: 3200,
          zillow_url: null,
          property_details: null,
        },
      });
    case "memberships":
      return chain({
        data: {
          id: "membership-1",
          plan_name: "Bi-Annual Preferred Care",
          price_display: "$450",
          started_at: "2026-01-01T00:00:00Z",
          status: "active",
          founding_member: true,
          founding_member_since: "2026-01-01T00:00:00Z",
          sales_tier: "biannual",
          visit_price: 450,
          visits_per_year: 2,
          payment_setup_completed_at: "2026-01-02T00:00:00Z",
          presentation_id: null,
          stripe_payment_method_id: "pm_test",
          membership_enrollment_savings: 75,
          portal_theme: null,
        },
      });
    case "member_profiles":
      // Migration 030: anon cannot read; service role may also have no row yet.
      return chain({ data: null });
    case "signed_agreements":
      return chain({ data: null });
    case "member_appointments":
      return chain({ data: appointmentRowsFixture });
    case "jobber_property_links":
      return chain({ data: propertyLinkFixture });
    case "jobber_visit_projections":
      return chain({ data: jobberVisitFixture });
    case "service_observations":
      return chain({ data: [] });
    case "property_assessments":
      return chain({ data: assessmentNoteFixture });
    case "property_assets":
      return chain({ data: propertyAssetFixture });
    case "member_addon_transactions":
      return chain({ data: [] });
    case "member_savings_transactions":
      return chain({ data: [] });
  }
  return chain({ data: null });
}

const mockPrivilegedClient = {
  from: vi.fn((table: string) => mockSupabaseFrom(table)),
  storage: {
    from: vi.fn(() => ({ createSignedUrl: createSignedUrlSpy })),
  },
};

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => mockPrivilegedClient),
  isSupabaseConfigured: () => true,
  isServiceRoleConfigured: () => true,
}));

vi.mock("@/lib/persistence/queries/load-membership-portal-row", () => ({
  loadMembershipPortalRow: vi.fn(async () => ({
    id: "membership-1",
    plan_name: "Bi-Annual Preferred Care",
    price_display: "$450",
    started_at: "2026-01-01T00:00:00Z",
    status: "active",
    founding_member: true,
    founding_member_since: "2026-01-01T00:00:00Z",
    sales_tier: "biannual",
    visit_price: 450,
    visits_per_year: 2,
    payment_setup_completed_at: "2026-01-02T00:00:00Z",
    presentation_id: null,
    stripe_payment_method_id: "pm_test",
    membership_enrollment_savings: 75,
    portal_theme: null,
  })),
}));

vi.mock("@/lib/membership/resolve-portal-payment-method", () => ({
  resolvePortalPaymentMethodLabel: vi.fn(async () => "Visa •••• 4242"),
}));

vi.mock("@/lib/agreement/signed-agreement-storage", () => ({
  resolveAgreementPdfAccessUrl: vi.fn(async () => null),
}));

vi.mock("@/lib/membership/member-savings-ledger-server", () => ({
  loadMemberSavingsLedgerView: vi.fn(async () => null),
}));

describe("migration 030 portal appointment regression", () => {
  afterEach(() => {
    insertSpy.mockClear();
    upsertSpy.mockClear();
    appointmentRowsFixture = [EXISTING_APPOINTMENT];
    propertyLinkFixture = null;
    jobberVisitFixture = null;
    assessmentNoteFixture = [];
    propertyAssetFixture = [];
    vi.clearAllMocks();
  });

  it("uses the privileged server client for portal loads", async () => {
    const clientModule = await import("@/lib/persistence/supabase/client");
    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(clientModule.createPrivilegedServerSupabaseClient).toHaveBeenCalled();
    expect(mockPrivilegedClient.from).toHaveBeenCalledWith("member_appointments");
  });

  it("loads existing appointments by property_id when member_profiles is unreadable", async () => {
    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data).not.toBeNull();
    expect(data?.appointments).toHaveLength(1);
    expect(data?.appointments[0]?.id).toBe("appt-existing-1");
    expect(data?.nextAppointment?.id).toBe("appt-existing-1");
  });

  it("does not insert or upsert appointments while loading portal data", async () => {
    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(insertSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("shows the next Jobber visit when the member property is paired", async () => {
    appointmentRowsFixture = [];
    propertyLinkFixture = {
      connection_id: "squeegeeking-jobber",
      external_property_id: "jobber-property-1",
    };
    jobberVisitFixture = {
      external_visit_id: "jobber-visit-1",
      scheduled_start: "2099-08-06T16:00:00.000Z",
      title: "Solar panel cleaning",
    };

    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data?.nextAppointment).toMatchObject({
      id: "jobber-jobber-visit-1",
      date: "2099-08-06T16:00:00.000Z",
      serviceType: "Solar panel cleaning",
      status: "scheduled",
    });
    expect(data?.appointments).toContainEqual(data?.nextAppointment);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("does not expose an unpaired Jobber visit in the portal", async () => {
    appointmentRowsFixture = [];
    jobberVisitFixture = {
      external_visit_id: "unpaired-visit",
      scheduled_start: "2099-08-06T16:00:00.000Z",
      title: "Unpaired service",
    };

    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data?.nextAppointment).toBeNull();
    expect(data?.appointments).toEqual([]);
  });

  it("does not present a stale scheduled appointment as the next visit", async () => {
    appointmentRowsFixture = [
      {
        ...EXISTING_APPOINTMENT,
        id: "stale-appointment",
        scheduled_at: "2020-08-15T14:00:00.000Z",
      },
    ];

    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data?.appointments).toHaveLength(1);
    expect(data?.nextAppointment).toBeNull();
  });

  it("uses a paired future Jobber visit when authoritative rows are stale", async () => {
    appointmentRowsFixture = [
      {
        ...EXISTING_APPOINTMENT,
        id: "stale-appointment",
        scheduled_at: "2020-08-15T14:00:00.000Z",
      },
    ];
    propertyLinkFixture = {
      connection_id: "squeegeeking-jobber",
      external_property_id: "jobber-property-1",
    };
    jobberVisitFixture = {
      external_visit_id: "future-jobber-visit",
      scheduled_start: "2099-09-06T16:00:00.000Z",
      title: "Exterior window care",
    };

    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );

    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data?.nextAppointment).toMatchObject({
      id: "jobber-future-jobber-visit",
      date: "2099-09-06T16:00:00.000Z",
      status: "scheduled",
    });
  });

  it("projects customer-visible field notes and private signed visit photos", async () => {
    assessmentNoteFixture = [
      {
        id: "assessment-1",
        field_record_id: "field-record-1",
        technician_name: "Noah",
        customer_note: "Exterior glass cleaned and inspected.",
        visit_date: "2026-08-14",
      },
    ];
    propertyAssetFixture = [
      {
        id: "asset-1",
        field_record_id: "field-record-1",
        storage_bucket: "homeatlas-visit-media",
        storage_path: "properties/property-1/visits/visit-1/after.jpg",
        title: "After service",
        description: null,
        capture_type: "after",
        captured_by: "Noah",
        is_primary: false,
        captured_at: "2026-08-14T18:00:00.000Z",
        created_at: "2026-08-14T18:00:00.000Z",
      },
    ];

    const { getMemberPortalDataBySlugs } = await import(
      "@/lib/persistence/queries/member-portal"
    );
    const data = await getMemberPortalDataBySlugs("sylvia-siegel", "chico-estate");

    expect(data?.observations).toContainEqual(
      expect.objectContaining({
        fieldRecordId: "field-record-1",
        observedBy: "Noah",
        notes: "Exterior glass cleaned and inspected.",
      }),
    );
    expect(data?.property.photos).toEqual([
      expect.objectContaining({
        fieldRecordId: "field-record-1",
        source: "our_team",
        caption: "After service",
        captureType: "after",
        capturedBy: "Noah",
        url: expect.stringContaining("/signed/properties/property-1"),
      }),
    ]);
    expect(createSignedUrlSpy).toHaveBeenCalledWith(
      propertyAssetFixture[0].storage_path,
      3600,
    );
  });
});
