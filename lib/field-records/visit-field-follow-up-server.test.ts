import { afterEach, describe, expect, it, vi } from "vitest";

let assessmentResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
let propertyResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
let homeownerResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
let rpcResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

function chain(result: () => { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result()).then(onfulfilled, onrejected);
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  if (table === "property_assessments") return chain(() => assessmentResult);
  if (table === "properties") return chain(() => propertyResult);
  if (table === "homeowners") return chain(() => homeownerResult);
  return chain(() => ({ data: [], error: null }));
});
const rpcSpy = vi.fn(() => ({
  single: vi.fn(async () => rpcResult),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({
    from: fromSpy,
    rpc: rpcSpy,
  })),
}));

describe("visit field follow-up server", () => {
  afterEach(() => {
    assessmentResult = { data: [], error: null };
    propertyResult = { data: [], error: null };
    homeownerResult = { data: [], error: null };
    rpcResult = { data: null, error: null };
    vi.clearAllMocks();
  });

  it("maps open visit actions onto the durable customer and property record", async () => {
    assessmentResult = {
      data: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          field_record_id: "33333333-3333-4333-8333-333333333333",
          property_id: "11111111-1111-4111-8111-111111111111",
          visit_id: "22222222-2222-4222-8222-222222222222",
          technician_name: "Noah",
          visit_date: "2026-08-14",
          customer_note: "Exterior glass complete.",
          internal_note: "Offer pressure washing estimate.",
          follow_up_due_at: "2026-08-17T16:00:00.000Z",
          created_at: "2026-08-14T20:00:00.000Z",
        },
      ],
      error: null,
    };
    propertyResult = {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          homeowner_id: "66666666-6666-4666-8666-666666666666",
          name: "Mandi's Home",
          address: "1420 Davis St",
          city: "Chico",
          state: "CA",
        },
      ],
      error: null,
    };
    homeownerResult = {
      data: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          full_name: "Mandi Homeowner",
        },
      ],
      error: null,
    };

    const { loadOpenVisitFieldFollowUps } = await import(
      "./visit-field-follow-up-server"
    );
    const followUps = await loadOpenVisitFieldFollowUps();

    expect(followUps).toEqual([
      expect.objectContaining({
        assessmentId: "55555555-5555-4555-8555-555555555555",
        homeownerName: "Mandi Homeowner",
        propertyName: "Mandi's Home",
        propertyAddress: "1420 Davis St, Chico, CA",
        internalNote: "Offer pressure washing estimate.",
      }),
    ]);
  });

  it("keeps owner actions created by the legacy document-visit form", async () => {
    assessmentResult = {
      data: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          field_record_id: null,
          property_id: "11111111-1111-4111-8111-111111111111",
          visit_id: null,
          technician_name: "Founder",
          visit_date: "2026-08-14",
          customer_note: null,
          internal_note: "Call about the pressure-washing add-on.",
          follow_up_due_at: "2026-08-17T16:00:00.000Z",
          created_at: "2026-08-14T20:00:00.000Z",
        },
      ],
      error: null,
    };
    propertyResult = {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          homeowner_id: "66666666-6666-4666-8666-666666666666",
          name: "Customer Home",
          address: "1420 Davis St",
          city: "Chico",
          state: "CA",
        },
      ],
      error: null,
    };
    homeownerResult = {
      data: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          full_name: "Customer",
        },
      ],
      error: null,
    };

    const { loadOpenVisitFieldFollowUps } = await import(
      "./visit-field-follow-up-server"
    );

    await expect(loadOpenVisitFieldFollowUps()).resolves.toEqual([
      expect.objectContaining({
        fieldRecordId: null,
        appointmentId: null,
        internalNote: "Call about the pressure-washing add-on.",
      }),
    ]);
  });

  it("fails soft while migration 054 is rolling out", async () => {
    assessmentResult = {
      data: null,
      error: {
        code: "42703",
        message: 'column "follow_up_status" does not exist',
      },
    };
    const { loadOpenVisitFieldFollowUps } = await import(
      "./visit-field-follow-up-server"
    );

    await expect(loadOpenVisitFieldFollowUps()).resolves.toEqual([]);
    expect(fromSpy).not.toHaveBeenCalledWith("properties");
  });

  it("resolves through the service-role RPC and trims operator identity", async () => {
    rpcResult = {
      data: {
        assessment_id: "55555555-5555-4555-8555-555555555555",
        resolved_at: "2026-08-14T21:00:00.000Z",
      },
      error: null,
    };
    const { resolveVisitFieldFollowUp } = await import(
      "./visit-field-follow-up-server"
    );

    await expect(
      resolveVisitFieldFollowUp({
        assessmentId: "55555555-5555-4555-8555-555555555555",
        resolvedBy: "  HQ operator  ",
      }),
    ).resolves.toEqual({
      assessmentId: "55555555-5555-4555-8555-555555555555",
      resolvedAt: "2026-08-14T21:00:00.000Z",
    });
    expect(rpcSpy).toHaveBeenCalledWith("resolve_visit_field_follow_up", {
      p_assessment_id: "55555555-5555-4555-8555-555555555555",
      p_resolved_by: "HQ operator",
    });
  });
});
