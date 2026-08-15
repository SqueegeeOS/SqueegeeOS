import { describe, expect, it, vi } from "vitest";

const assessmentRows = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    property_id: "11111111-1111-4111-8111-111111111111",
    visit_id: "22222222-2222-4222-8222-222222222222",
    field_record_id: "33333333-3333-4333-8333-333333333333",
    assessment_type: "visit_note",
    technician_name: "Noah",
    visit_date: "2026-08-14",
    scores: {},
    assessed_areas: [],
    na_areas: [],
    overall_score: null,
    internal_note: "Call about the pressure-washing add-on.",
    customer_note: "Exterior glass complete.",
    customer_note_visible: true,
    proposal_summary: "Follow-up recommended",
    recommended_services: [],
    follow_up_status: "resolved",
    follow_up_due_at: "2026-08-17T16:00:00.000Z",
    follow_up_resolved_at: "2026-08-17T17:30:00.000Z",
    follow_up_resolved_by: "HQ operator",
    proposal_sent: false,
    proposal_sent_at: null,
    created_at: "2026-08-14T20:00:00.000Z",
    updated_at: "2026-08-17T17:30:00.000Z",
  },
];

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) =>
    Promise.resolve({ data: assessmentRows, error: null }).then(
      onfulfilled,
      onrejected,
    );
  return builder;
}

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: vi.fn(() => true),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder()),
  })),
}));

describe("property assessment follow-up history", () => {
  it("maps the durable open/resolved fields into the HQ property record", async () => {
    const { listStaffAssessments } = await import("./assessment-repository");

    await expect(
      listStaffAssessments("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual([
      expect.objectContaining({
        fieldRecordId: "33333333-3333-4333-8333-333333333333",
        followUpStatus: "resolved",
        followUpDueAt: "2026-08-17T16:00:00.000Z",
        followUpResolvedAt: "2026-08-17T17:30:00.000Z",
        followUpResolvedBy: "HQ operator",
      }),
    ]);
  });
});
