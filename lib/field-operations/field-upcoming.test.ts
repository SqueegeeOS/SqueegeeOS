import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";
import { fieldUpcomingVisits } from "./field-upcoming";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), board: vi.fn() }));
vi.mock("@/lib/field-operations/field-access", () => ({ authorizeFieldRequest: mocks.authorize }));
vi.mock("@/lib/care-operations/jobber-today", () => ({ loadJobberTodayBoard: mocks.board }));
import { GET } from "@/app/api/field/upcoming/route";

function visit(id: string, days: number, tech = "homeatlas:tyler"): JobberTodayVisit {
  return { projectionId: id, clientName: `Household ${id}`, title: "Window cleaning",
    scheduledStart: new Date(Date.now() + days * 86400000).toISOString(), scheduledEnd: null,
    propertyLabel: "1 Test Street", isComplete: false, visitStatus: "SCHEDULED",
    homeAtlasFieldAssignmentId: `assignment-${id}`, homeAtlasAssignedTechnicianId: tech, assignedUsers: [], assignmentReadState: "available",
    homeAtlasFieldInternalNote: "Private owner information", homeAtlasPortalPath: "/private-token",
  } as unknown as JobberTodayVisit;
}
const request = () => GET(new Request("https://www.squeegeeking.net/api/field/upcoming"));
describe("upcoming technician schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ kind: "technician", jobberUserId: "homeatlas:tyler" });
    mocks.board.mockResolvedValue({ visits: [visit("later", 20), visit("other", 3, "homeatlas:other"), visit("next", 2), visit("past", -2)], fieldFollowUps: [] });
  });
  it("requires authentication before loading the schedule", async () => {
    mocks.authorize.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(mocks.board).not.toHaveBeenCalled();
  });
  it("returns only this technician's future assignments, ordered, with a minimal private DTO", async () => {
    const response = await request();
    const body = await response.json();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.visits.map((row: { id: string }) => row.id)).toEqual(["next", "later"]);
    expect(Object.keys(body.visits[0]).sort()).toEqual(["id", "clientName", "service", "scheduledStart", "scheduledEnd", "address"].sort());
    expect(JSON.stringify(body)).not.toContain("Private owner information");
    expect(JSON.stringify(body)).not.toContain("private-token");
    const [start, end] = mocks.board.mock.calls[0];
    expect(end.getTime() - start.getTime()).toBe(45 * 86400000);
  });
  it("allows owners to preview all future assignments", async () => {
    mocks.authorize.mockResolvedValue({ kind: "admin" });
    expect((await (await request()).json()).visits).toHaveLength(3);
  });
  it("does not expose a native job through a stale Jobber crew entry", async () => {
    const reassigned = visit("reassigned", 2, "homeatlas:other");
    reassigned.assignedUsers = [{ id: "homeatlas:tyler", name: "Previous assignment" }];
    const incomplete = { ...visit("incomplete", 2), homeAtlasFieldAssignmentId: null };
    mocks.board.mockResolvedValue({ visits: [reassigned, incomplete, visit("mine", 3)] });
    expect((await (await request()).json()).visits.map((row: { id: string }) => row.id)).toEqual(["mine"]);
  });
  it("excludes completed, removed, invalid, and earlier dates without mutating the board", () => {
    const visits = [visit("complete", 2), visit("removed", 2), visit("bad", 2), visit("valid", 3)];
    visits[0].isComplete = true; visits[1].visitStatus = "REMOVED"; visits[2].scheduledStart = "invalid";
    expect(fieldUpcomingVisits(visits, new Date()).map(row => row.id)).toEqual(["valid"]);
    expect(visits.map(row => row.projectionId)).toEqual(["complete", "removed", "bad", "valid"]);
  });
  it("does not silently discard assignments after the twentieth job", () => {
    expect(fieldUpcomingVisits(Array.from({ length: 25 }, (_, i) => visit(String(i), 2)), new Date())).toHaveLength(25);
  });
  it("reports load failures without leaking provider details", async () => {
    mocks.board.mockRejectedValue(new Error("secret database detail"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
