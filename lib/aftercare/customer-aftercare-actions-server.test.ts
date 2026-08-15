import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomerAftercareSnapshot } from "./customer-aftercare";

const IDS = {
  homeowner: "11111111-1111-4111-8111-111111111111",
  property: "22222222-2222-4222-8222-222222222222",
  membership: "33333333-3333-4333-8333-333333333333",
  appointment: "44444444-4444-4444-8444-444444444444",
  resolution: "55555555-5555-4555-8555-555555555555",
};

let snapshot: CustomerAftercareSnapshot;
let existingData: unknown = null;
let savedData: unknown = null;
const upsertSpy = vi.fn();

vi.mock("./customer-aftercare-server", () => ({
  loadCustomerAftercareSnapshot: vi.fn(async () => snapshot),
}));

function resolutionRow(outcome = "review_requested") {
  return {
    id: IDS.resolution,
    task_key: `review-opportunity:${IDS.appointment}`,
    task_type: "review_opportunity",
    resolution: outcome === "not_appropriate" ? "dismissed" : "completed",
    outcome,
    note: null,
    recorded_by: "HQ owner",
    recorded_at: "2026-08-14T18:00:00.000Z",
  };
}

function createBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.upsert = vi.fn((...args: unknown[]) => {
    upsertSpy(...args);
    return builder;
  });
  builder.single = vi.fn(async () => ({ data: savedData, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: existingData, error: null }));
  return builder;
}

const fromSpy = vi.fn(() => createBuilder());

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

function openSnapshot(): CustomerAftercareSnapshot {
  return {
    generatedAt: "2026-08-14T18:00:00.000Z",
    truncated: false,
    serviceCases: [],
    tasks: [
      {
        taskKey: `review-opportunity:${IDS.appointment}`,
        type: "review_opportunity",
        homeownerId: IDS.homeowner,
        propertyId: IDS.property,
        membershipId: IDS.membership,
        appointmentId: IDS.appointment,
        homeownerName: "Mandi Rivera",
        propertyLabel: "Davis Street Residence",
        dueAt: "2026-08-13T18:00:00.000Z",
        evidenceAt: "2026-08-12T18:00:00.000Z",
        serviceLabel: "Exterior Window Cleaning",
        completedAt: "2026-08-12T18:00:00.000Z",
        customerSummaryVisible: true,
        customerPhotoVisible: true,
      },
    ],
  };
}

describe("customer aftercare outcome writer", () => {
  afterEach(() => {
    snapshot = openSnapshot();
    existingData = null;
    savedData = resolutionRow();
    vi.clearAllMocks();
  });

  it("records an explicit disposition without contacting a provider", async () => {
    snapshot = openSnapshot();
    savedData = resolutionRow();
    const { recordCustomerAftercareOutcome } = await import(
      "./customer-aftercare-actions-server"
    );
    const result = await recordCustomerAftercareOutcome(
      {
        taskKey: `review-opportunity:${IDS.appointment}`,
        outcome: "review_requested",
        note: "Asked by phone after a good visit.",
      },
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(result).toMatchObject({ duplicate: false });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "review_opportunity",
        outcome: "review_requested",
        resolution: "completed",
        homeowner_id: IDS.homeowner,
        appointment_id: IDS.appointment,
      }),
      { onConflict: "task_key", ignoreDuplicates: true },
    );
  });

  it("rejects an outcome that belongs to another task type", async () => {
    snapshot = openSnapshot();
    const { recordCustomerAftercareOutcome } = await import(
      "./customer-aftercare-actions-server"
    );

    await expect(
      recordCustomerAftercareOutcome({
        taskKey: `review-opportunity:${IDS.appointment}`,
        outcome: "checkin_completed",
      }),
    ).rejects.toMatchObject({ code: "outcome_mismatch", status: 400 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("returns the same resolution for an idempotent repeated command", async () => {
    snapshot = { ...openSnapshot(), tasks: [] };
    existingData = resolutionRow();
    const { recordCustomerAftercareOutcome } = await import(
      "./customer-aftercare-actions-server"
    );

    await expect(
      recordCustomerAftercareOutcome({
        taskKey: `review-opportunity:${IDS.appointment}`,
        outcome: "review_requested",
      }),
    ).resolves.toMatchObject({ duplicate: true });
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
