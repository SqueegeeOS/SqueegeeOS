import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TechnicianFieldActor } from "./field-access";
const mocks = vi.hoisted(() => ({ client: vi.fn(), actor: vi.fn(), write: vi.fn(), tables: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.client }));
vi.mock("./field-access", () => ({ authorizeFieldRequest: mocks.actor }));
vi.mock("./technician-job-clock-server", () => ({ recordTechnicianJobClockAction: mocks.write, assertTechnicianCanDocumentVisit: mocks.write, assertTechnicianCanFinishJob: mocks.write }));
vi.mock("./technician-visit-event-server", () => ({ recordTechnicianVisitEvent: mocks.write, loadTechnicianVisitEventSnapshots: mocks.write }));
vi.mock("@/lib/field-records/visit-field-record-server", () => ({ commitFieldAssignmentCloseout: mocks.write, commitVisitFieldRecord: mocks.write, createFieldAssignmentPhotoUploadIntents: mocks.write, createVisitPhotoUploadIntents: mocks.write }));
import { assertTechnicianAssignedToAppointment, assertFieldActorCanWriteAppointment } from "./field-scope";
import { POST as clock } from "@/app/api/field/job-clock/route";
import { POST as event } from "@/app/api/field/visit-events/route";
import { POST as upload } from "@/app/api/field/field-records/upload-intents/route";
import { POST as closeout } from "@/app/api/field/field-records/route";

const id = "11111111-1111-4111-8111-111111111111";
const actor: TechnicianFieldActor = { kind: "technician", role: "technician", grantId: id, jobberUserId: "old-jobber-tech", displayName: "Old crew", sessionExpiresAt: "2099-01-01T00:00:00Z" };
function projection(native: unknown = null) {
  return { scheduled_start: new Date().toISOString(), native_assignment: native, raw_payload: { assignmentReadState: "available", assignedUsers: [{ id: actor.jobberUserId, name: actor.displayName }] } };
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.actor.mockResolvedValue(actor);
  mocks.tables = {
    member_appointments: { data: { property_id: id, provider: "jobber", external_id: "visit-1" }, error: null },
    jobber_visit_projections: { data: projection(), error: null },
  };
  mocks.client.mockReturnValue({ from: (table: string) => {
    const builder: Record<string, unknown> = { maybeSingle: () => Promise.resolve(mocks.tables[table]) };
    for (const method of ["select", "eq"]) builder[method] = () => builder;
    return builder;
  } });
});

describe("legacy appointment write scope follows current staffing", () => {
  it("preserves a verified legacy Jobber-only assignment", async () => {
    await expect(assertTechnicianAssignedToAppointment(actor, id, id)).resolves.toBeUndefined();
  });
  it.each([{ id }, [{ id }]])("rejects stale mirrored crew when native staffing exists (%j)", async native => {
    mocks.tables.jobber_visit_projections.data = projection(native);
    await expect(assertTechnicianAssignedToAppointment(actor, id, id)).rejects.toThrow("not available to this Field Pass");
  });
  it("fails closed when current native staffing was not returned", async () => {
    mocks.tables.jobber_visit_projections.data = { ...projection(), native_assignment: undefined };
    await expect(assertTechnicianAssignedToAppointment(actor, id, id)).rejects.toThrow("Could not verify");
  });
  it("fails closed on a relation read error", async () => {
    mocks.tables.jobber_visit_projections = { data: null, error: { message: "relation unavailable" } };
    await expect(assertTechnicianAssignedToAppointment(actor, id, id)).rejects.toThrow();
  });
  it("still rejects a different mirrored technician and an expired write window", async () => {
    await expect(assertTechnicianAssignedToAppointment({ ...actor, jobberUserId: "other-tech" }, id, id)).rejects.toThrow("not assigned");
    await expect(assertTechnicianAssignedToAppointment(actor, id, id, new Date("2099-01-01T00:00:00Z"))).rejects.toThrow("outside the safe");
  });
  it("preserves explicit owner authority without technician lookups", async () => {
    await assertFieldActorCanWriteAppointment({ kind: "admin", displayName: "HomeAtlas HQ", grantId: null, jobberUserId: null }, id, id);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});

describe("all legacy field mutations reject native job targets before side effects", () => {
  const target = { propertyId: id, appointmentId: id };
  const cases = [
    { name: "clock", handler: clock, body: { ...target, actionId: id, action: "start" } },
    { name: "event", handler: event, body: { ...target, eventId: id, eventType: "arrived" } },
    { name: "photo upload", handler: upload, body: { ...target, fieldRecordId: id, photos: [{ clientId: id, fileName: "proof.jpg", mimeType: "image/jpeg", sizeBytes: 100, captureType: "after", customerVisible: false }] } },
    { name: "closeout", handler: closeout, body: { ...target, fieldRecordId: id, technicianName: "Spoofed name", visitDate: "2026-09-04", customerSummary: "Done", internalNote: "", followUpNeeded: false, scopeReadState: "available", serviceScope: [], scopeException: "", photos: [] } },
  ];
  it.each(cases)("blocks $name with no write/upload/event", async ({ handler, body }) => {
    mocks.tables.jobber_visit_projections.data = projection({ id });
    const response = await handler(new Request("https://www.squeegeeking.net/api/field/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("not available to this Field Pass");
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
