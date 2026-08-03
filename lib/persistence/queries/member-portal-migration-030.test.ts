import { afterEach, describe, expect, it, vi } from "vitest";

const EXISTING_APPOINTMENT = {
  id: "appt-existing-1",
  member_profile_id: null,
  property_id: "property-1",
  service_type: "window_cleaning",
  scheduled_at: "2026-08-15T14:00:00.000Z",
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

function chain(result: { data?: unknown; error?: unknown; count?: number }) {
  const promise = Promise.resolve(result);
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "in",
    "gte",
    "neq",
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
    case "member_addon_transactions":
      return chain({ data: [] });
    case "member_savings_transactions":
      return chain({ data: [] });
  }
  return chain({ data: null });
}

const mockPrivilegedClient = {
  from: vi.fn((table: string) => mockSupabaseFrom(table)),
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
});
