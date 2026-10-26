import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), appointment: vi.fn(), assignment: vi.fn(), canFinish: vi.fn(),
  record: vi.fn(), snapshots: vi.fn(), event: vi.fn(),
}));
vi.mock("./field-access", () => ({ authorizeFieldRequest: mocks.authorize }));
vi.mock("./field-scope", () => ({ assertFieldActorCanWriteAppointment: mocks.appointment, assertTechnicianAssignedToFieldAssignment: mocks.assignment }));
vi.mock("./technician-job-clock-server", () => ({ assertTechnicianCanFinishJob: mocks.canFinish, recordTechnicianJobClockAction: mocks.record }));
vi.mock("./technician-visit-event-server", () => ({ loadTechnicianVisitEventSnapshots: mocks.snapshots, recordTechnicianVisitEvent: mocks.event }));
import { POST } from "@/app/api/field/job-clock/route";
const id = "11111111-1111-4111-8111-111111111111";
const actor = { kind: "technician", displayName: "Test Tech", grantId: id, jobberUserId: `homeatlas:${id}` };
const running = { state: "running", startedAt: "2026-10-25T20:00:00Z", endedAt: null, durationSeconds: null, startedByDisplayName: "Test Tech", finishedByDisplayName: null };
const finished = { ...running, state: "finished", endedAt: "2026-10-25T21:00:00Z", durationSeconds: 3600 };
function request(action = "start", native = true) {
  return new Request("https://homeatlas.example/api/field/job-clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: id, action, ...(native ? { fieldAssignmentId: id } : { propertyId: id, appointmentId: id }) }) });
}
describe("durable technician clock endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.authorize.mockResolvedValue(actor);
    mocks.record.mockResolvedValue({ entryId: id, clock: running, replayed: false });
    mocks.snapshots.mockResolvedValue({ available: true, byAppointmentId: new Map() });
  });
  it("returns authoritative native time without legacy events", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ clock: running, fieldStage: "service_started" });
    expect(mocks.assignment).toHaveBeenCalledWith(actor, id);
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("preserves clock-out when the secondary timeline fails", async () => {
    mocks.record.mockResolvedValue({ entryId: id, clock: finished, replayed: false });
    mocks.snapshots.mockRejectedValue(new Error("temporary timeline outage"));
    const response = await POST(request("finish", false)); const body = await response.json();
    expect(response.status).toBe(201); expect(body.clock).toEqual(finished);
    expect(body.routeEventRecorded).toBe(false); expect(body.routeEventWarning).toContain("time is saved");
    expect(body).not.toHaveProperty("fieldStage");
  });
  it("replays finished clock without changing timestamps", async () => {
    mocks.record.mockResolvedValue({ entryId: id, clock: finished, replayed: true });
    const response = await POST(request("finish"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ clock: finished, replayed: true, fieldStage: "departed" });
  });
  it("does not reset stage when an old start replays a finished clock", async () => {
    mocks.record.mockResolvedValue({ entryId: id, clock: finished, replayed: true });
    expect(await (await POST(request("start"))).json()).toMatchObject({ clock: finished, fieldStage: "departed" });
  });
  it("reports another running job as recoverable conflict", async () => {
    mocks.record.mockRejectedValue(new Error("Clock out of your other active job before starting this one."));
    expect((await POST(request())).status).toBe(409);
  });
  it("does not write after assignment verification failure", async () => {
    mocks.assignment.mockRejectedValue(new Error("This job is not assigned to this Field Pass."));
    expect((await POST(request())).status).toBe(403); expect(mocks.record).not.toHaveBeenCalled();
  });
  it("fails closed without session", async () => {
    mocks.authorize.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401); expect(mocks.record).not.toHaveBeenCalled();
  });
});
