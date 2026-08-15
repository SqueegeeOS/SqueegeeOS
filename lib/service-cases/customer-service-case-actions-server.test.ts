import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalAccessContext } from "@/lib/persistence/queries/portal-access";

type QueryResult = { data: unknown; error: { message: string } | null };

const IDS = {
  membership: "11111111-1111-4111-8111-111111111111",
  homeowner: "22222222-2222-4222-8222-222222222222",
  property: "33333333-3333-4333-8333-333333333333",
  request: "44444444-4444-4444-8444-444444444444",
  serviceCase: "55555555-5555-4555-8555-555555555555",
  appointment: "66666666-6666-4666-8666-666666666666",
};

const access: PortalAccessContext = {
  membershipId: IDS.membership,
  homeownerId: IDS.homeowner,
  propertyId: IDS.property,
  memberName: "Mandi Rivera",
  homeownerSlug: "mandi-rivera",
  propertySlug: "davis-street",
  portalAccessToken: "secret-token",
};

const upsertSpy = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
let appointmentResult: QueryResult;
let upsertResult: QueryResult;
let updateResult: QueryResult;
let readResults: QueryResult[];
let capacityResult: QueryResult;

function row(status = "open") {
  return {
    id: IDS.serviceCase,
    membership_id: IDS.membership,
    homeowner_id: IDS.homeowner,
    property_id: IDS.property,
    appointment_id: null,
    client_request_id: IDS.request,
    category: "service_quality",
    details: "The lower window still has visible spotting.",
    status,
    owner_note: null,
    acknowledged_at: null,
    resolved_at: status === "resolved" ? "2026-08-14T18:00:00.000Z" : null,
    created_at: "2026-08-14T16:00:00.000Z",
    updated_at: "2026-08-14T16:00:00.000Z",
  };
}

function builder(table: string) {
  let mode: "read" | "capacity" | "upsert" | "update" = "read";
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((columns: string) => {
    if (table === "customer_service_cases" && columns === "id") {
      mode = "capacity";
    }
    return chain;
  });
  chain.eq = vi.fn((field: string, value: unknown) => {
    eqSpy(table, field, value);
    return chain;
  });
  chain.order = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.upsert = vi.fn((payload: unknown, options: unknown) => {
    mode = "upsert";
    upsertSpy(payload, options);
    return chain;
  });
  chain.update = vi.fn((payload: unknown) => {
    mode = "update";
    updateSpy(payload);
    return chain;
  });
  chain.maybeSingle = vi.fn(async () => {
    if (table === "member_appointments") return appointmentResult;
    if (mode === "upsert") return upsertResult;
    if (mode === "update") return updateResult;
    return readResults.shift() ?? { data: null, error: null };
  });
  chain.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) =>
    Promise.resolve(
      mode === "capacity" ? capacityResult : { data: null, error: null },
    ).then(onfulfilled, onrejected);
  return chain;
}

const fromSpy = vi.fn((table: string) => builder(table));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

describe("customer service case writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointmentResult = { data: { id: IDS.appointment }, error: null };
    upsertResult = { data: row(), error: null };
    updateResult = { data: row("resolved"), error: null };
    readResults = [];
    capacityResult = { data: [], error: null };
  });

  it("derives stored customer identity from verified portal access", async () => {
    const { createPortalServiceCase } = await import(
      "./customer-service-case-actions-server"
    );
    const result = await createPortalServiceCase({
      access,
      clientRequestId: IDS.request,
      category: "service_quality",
      details: "The lower window still has visible spotting.",
    });

    expect(result.duplicate).toBe(false);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        membership_id: IDS.membership,
        homeowner_id: IDS.homeowner,
        property_id: IDS.property,
        client_request_id: IDS.request,
        status: "open",
        source: "member_portal",
      }),
      {
        onConflict: "membership_id,client_request_id",
        ignoreDuplicates: true,
      },
    );
  });

  it("refuses to link a visit outside the authorized property", async () => {
    appointmentResult = { data: null, error: null };
    const { createPortalServiceCase } = await import(
      "./customer-service-case-actions-server"
    );

    await expect(
      createPortalServiceCase({
        access,
        clientRequestId: IDS.request,
        category: "service_quality",
        appointmentId: IDS.appointment,
        details: "This issue concerns the selected visit at the home.",
      }),
    ).rejects.toMatchObject({ code: "appointment_not_available", status: 400 });
    expect(eqSpy).toHaveBeenCalledWith(
      "member_appointments",
      "property_id",
      IDS.property,
    );
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("returns the original case when the browser safely retries", async () => {
    readResults = [{ data: row(), error: null }];
    const { createPortalServiceCase } = await import(
      "./customer-service-case-actions-server"
    );
    const result = await createPortalServiceCase({
      access,
      clientRequestId: IDS.request,
      category: "service_quality",
      details: "The lower window still has visible spotting.",
    });

    expect(result).toMatchObject({ duplicate: true, serviceCase: { id: IDS.serviceCase } });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("caps unresolved portal cases without contacting a provider", async () => {
    capacityResult = {
      data: Array.from({ length: 5 }, (_, index) => ({ id: `case-${index}` })),
      error: null,
    };
    const { createPortalServiceCase } = await import(
      "./customer-service-case-actions-server"
    );

    await expect(
      createPortalServiceCase({
        access,
        clientRequestId: IDS.request,
        category: "other",
        details: "I have another question about the care for my home.",
      }),
    ).rejects.toMatchObject({ code: "open_case_limit", status: 429 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("requires a private reason before dismissing a customer concern", async () => {
    const { recordCustomerServiceCaseAction } = await import(
      "./customer-service-case-actions-server"
    );

    await expect(
      recordCustomerServiceCaseAction({
        caseId: IDS.serviceCase,
        action: "dismiss",
      }),
    ).rejects.toMatchObject({ code: "dismissal_note_required", status: 400 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("records an explicit resolution without a messaging side effect", async () => {
    readResults = [{ data: row(), error: null }];
    const { recordCustomerServiceCaseAction } = await import(
      "./customer-service-case-actions-server"
    );
    const result = await recordCustomerServiceCaseAction(
      {
        caseId: IDS.serviceCase,
        action: "resolve",
        note: "Spoke with the customer and scheduled a touch-up.",
      },
      new Date("2026-08-14T18:00:00.000Z"),
    );

    expect(result.duplicate).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith({
      status: "resolved",
      owner_note: "Spoke with the customer and scheduled a touch-up.",
      handled_by: "HQ owner",
      acknowledged_at: "2026-08-14T18:00:00.000Z",
      resolved_at: "2026-08-14T18:00:00.000Z",
    });
  });
});
