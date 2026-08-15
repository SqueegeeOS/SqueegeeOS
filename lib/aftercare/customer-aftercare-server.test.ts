import { afterEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { message: string } | null };

const IDS = {
  homeowner: "11111111-1111-4111-8111-111111111111",
  property: "22222222-2222-4222-8222-222222222222",
  membership: "33333333-3333-4333-8333-333333333333",
  profile: "44444444-4444-4444-8444-444444444444",
  appointment: "55555555-5555-4555-8555-555555555555",
  fieldRecord: "66666666-6666-4666-8666-666666666666",
  serviceCase: "77777777-7777-4777-8777-777777777777",
};

let results: Record<string, QueryResult> = {};

function chain(result: () => QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "not",
    "order",
    "limit",
    "gte",
    "lte",
    "in",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result()).then(onfulfilled, onrejected);
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  if (!(table in results)) throw new Error(`Unexpected table ${table}`);
  return chain(() => results[table]);
});

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

function healthyResults(): Record<string, QueryResult> {
  return {
    memberships: {
      data: [
        {
          id: IDS.membership,
          homeowner_id: IDS.homeowner,
          property_id: IDS.property,
          started_at: "2025-08-20T01:00:00.000Z",
        },
      ],
      error: null,
    },
    member_appointments: {
      data: [
        {
          id: IDS.appointment,
          member_profile_id: IDS.profile,
          property_id: IDS.property,
          service_type: "exterior_window_cleaning",
          completed_at: "2026-08-12T17:00:00.000Z",
        },
      ],
      error: null,
    },
    member_profiles: {
      data: [{ id: IDS.profile, homeowner_id: IDS.homeowner }],
      error: null,
    },
    property_assessments: {
      data: [
        {
          visit_id: IDS.appointment,
          field_record_id: IDS.fieldRecord,
          follow_up_status: null,
          customer_note_visible: true,
        },
      ],
      error: null,
    },
    property_assets: {
      data: [{ visit_id: IDS.appointment }],
      error: null,
    },
    homeowners: {
      data: [{ id: IDS.homeowner, full_name: "Mandi Rivera" }],
      error: null,
    },
    properties: {
      data: [
        {
          id: IDS.property,
          name: "Davis Street Residence",
          address: "1420 Davis Street",
          city: "Chico",
          state: "CA",
        },
      ],
      error: null,
    },
    customer_aftercare_resolutions: { data: [], error: null },
    customer_service_cases: { data: [], error: null },
  };
}

describe("customer aftercare snapshot", () => {
  afterEach(() => {
    results = healthyResults();
    vi.clearAllMocks();
  });

  it("derives review and annual-care tasks from verified records without writes", async () => {
    results = healthyResults();
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );
    const snapshot = await loadCustomerAftercareSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      generatedAt: "2026-08-14T18:00:00.000Z",
      serviceCases: [],
      truncated: false,
    });
    expect(snapshot.tasks).toEqual([
      expect.objectContaining({
        taskKey: `review-opportunity:${IDS.appointment}`,
        type: "review_opportunity",
        homeownerName: "Mandi Rivera",
        serviceLabel: "Exterior Window Cleaning",
        customerSummaryVisible: true,
        customerPhotoVisible: true,
      }),
      expect.objectContaining({
        taskKey: `annual-care-checkin:${IDS.membership}:2026`,
        type: "annual_care_checkin",
        anniversaryNumber: 1,
      }),
    ]);
    expect(fromSpy.mock.calls.map(([table]) => table)).toContain(
      "customer_aftercare_resolutions",
    );
  });

  it("puts customer-reported concerns ahead of derived aftercare work", async () => {
    results = healthyResults();
    results.customer_service_cases = {
      data: [
        {
          id: IDS.serviceCase,
          membership_id: IDS.membership,
          homeowner_id: IDS.homeowner,
          property_id: IDS.property,
          appointment_id: IDS.appointment,
          category: "service_quality",
          details: "A lower window still has visible spotting after the visit.",
          status: "open",
          owner_note: null,
          acknowledged_at: null,
          resolved_at: null,
          created_at: "2026-08-14T16:00:00.000Z",
          updated_at: "2026-08-14T16:00:00.000Z",
        },
      ],
      error: null,
    };
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );
    const snapshot = await loadCustomerAftercareSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot.serviceCases).toEqual([
      expect.objectContaining({
        id: IDS.serviceCase,
        homeownerName: "Mandi Rivera",
        category: "service_quality",
        status: "open",
        appointmentId: IDS.appointment,
      }),
    ]);
  });

  it("does not suggest a review while service recovery is still open", async () => {
    results = healthyResults();
    results.property_assessments = {
      data: [
        {
          visit_id: IDS.appointment,
          field_record_id: IDS.fieldRecord,
          follow_up_status: "open",
          customer_note_visible: true,
        },
      ],
      error: null,
    };
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );
    const snapshot = await loadCustomerAftercareSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]?.type).toBe("annual_care_checkin");
  });

  it("requires customer-visible proof before calling a visit review-ready", async () => {
    results = healthyResults();
    results.property_assessments = {
      data: [
        {
          visit_id: IDS.appointment,
          field_record_id: IDS.fieldRecord,
          follow_up_status: null,
          customer_note_visible: false,
        },
      ],
      error: null,
    };
    results.property_assets = { data: [], error: null };
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );
    const snapshot = await loadCustomerAftercareSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot.tasks.map((task) => task.type)).toEqual([
      "annual_care_checkin",
    ]);
  });

  it("removes tasks that already have an explicit owner disposition", async () => {
    results = healthyResults();
    results.customer_aftercare_resolutions = {
      data: [{ task_key: `review-opportunity:${IDS.appointment}` }],
      error: null,
    };
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );
    const snapshot = await loadCustomerAftercareSnapshot(
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(snapshot.tasks.map((task) => task.type)).toEqual([
      "annual_care_checkin",
    ]);
  });

  it("fails closed when the disposition ledger cannot be verified", async () => {
    results = healthyResults();
    results.customer_aftercare_resolutions = {
      data: null,
      error: { message: "aftercare schema missing" },
    };
    const { loadCustomerAftercareSnapshot } = await import(
      "./customer-aftercare-server"
    );

    await expect(loadCustomerAftercareSnapshot()).rejects.toThrow(
      "aftercare schema missing",
    );
  });
});
