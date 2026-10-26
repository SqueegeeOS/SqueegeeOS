// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TechnicianTodayWorkspace } from "@/components/field/technician-today-workspace";
import { EMPTY_TECHNICIAN_JOB_CLOCK, type TechnicianJobClockSnapshot } from "./technician-job-clock";
import { summarizeJobberTodayVisits, type JobberTodayData, type JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/dynamic", () => ({ default: () => function CaptureStub() {
  const [selected, setSelected] = useState(0);
  return createElement("button", { onClick: () => setSelected((count) => count + 1) }, `Test selected photos: ${selected}`);
} }));
vi.mock("@/components/craft/ambient-stage", () => ({ AmbientStage: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("@/components/field/technician-upcoming", () => ({ TechnicianUpcoming: () => null }));
vi.mock("@/components/field/technician-job-addons", () => ({ TechnicianJobAddons: () => null }));
vi.mock("@/components/field/job-value", () => ({ JobValue: () => null }));

const running: TechnicianJobClockSnapshot = { ...EMPTY_TECHNICIAN_JOB_CLOCK, state: "running", startedAt: "2026-10-26T06:00:00Z", startedByDisplayName: "Test technician" };
const finished: TechnicianJobClockSnapshot = { ...running, state: "finished", endedAt: "2026-10-26T07:00:00Z", durationSeconds: 3600, finishedByDisplayName: "Test technician" };
function visit(overrides: Partial<JobberTodayVisit> = {}): JobberTodayVisit {
  return {
    projectionId: "projection-1", externalVisitId: "visit-1", clientName: "Test property", title: "Test service", jobNumber: 1,
    visitStatus: "scheduled", jobStatus: "active", scheduledStart: "2026-10-26T06:00:00Z", scheduledEnd: "2026-10-26T07:00:00Z", isComplete: false,
    assignedUsers: [], assignmentReadState: "available", scopeItems: [], scopeReadState: "available", propertyLabel: "Test address", jobberPropertyWebUri: null, jobberClientWebUri: null,
    homeAtlasPropertyId: null, homeAtlasAppointmentId: null, homeAtlasFieldAssignmentId: "d1111111-1111-4111-8111-111111111111", homeAtlasAssignedTechnicianId: "test-tech", homeAtlasAssignedTechnicianName: "Test technician", homeAtlasMembershipId: null, homeAtlasPortalPath: null,
    homeAtlasFieldRecordCount: 0, homeAtlasLatestFieldRecordAt: null, homeAtlasLatestFieldRecordBy: null, homeAtlasCustomerVisibleRecordCount: 0, homeAtlasOpenFollowUpCount: 0,
    homeAtlasFieldCustomerSummary: null, homeAtlasFieldInternalNote: null, homeAtlasFieldScopeException: null, homeAtlasFieldPhotoCount: 0,
    homeAtlasFieldStage: "not_started", homeAtlasFieldStageAt: null, homeAtlasFieldStageBy: null, homeAtlasFieldEventCount: 0, homeAtlasJobClock: EMPTY_TECHNICIAN_JOB_CLOCK, homeAtlasIndependenceReview: null,
    ...overrides,
  };
}
function today(visits = [visit()]): JobberTodayData {
  return { calendarDate: "2026-10-26", timezone: "UTC", connected: true, connectionStatus: "connected", accountName: "Test company", lastSyncedAt: "2026-10-26T06:00:00Z", loadedAt: "2026-10-26T06:01:00Z", fieldRecordStatusAvailable: true, fieldEventStatusAvailable: true, jobClockStatusAvailable: true, independenceReviewStatusAvailable: true, summary: summarizeJobberTodayVisits(visits), visits, fieldFollowUps: [] };
}
let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  localStorage.clear();
  fetchMock = vi.fn();
  // Every HTTP operation is handled in-memory; no provider requests are allowed.
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function renderWorkspace() {
  await act(async () => root.render(createElement(TechnicianTodayWorkspace, { actorKind: "technician", actorDisplayName: "Test technician" })));
}
function button(text: string) {
  const value = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((element) => element.textContent?.includes(text));
  if (!value) throw new Error(`No button: ${text}`);
  return value;
}
async function click(text: string) { await act(async () => button(text).click()); }

describe("technician workspace interruptions (all HTTP mocked)", () => {
  it.each(["start", "finish"] as const)("keeps confirmed %s visible when the next read fails", async (action) => {
    fetchMock.mockResolvedValueOnce(Response.json(today([visit(action === "finish" ? { homeAtlasJobClock: running, homeAtlasFieldRecordCount: 1 } : {})])))
      .mockResolvedValueOnce(Response.json({ clock: action === "start" ? running : finished, fieldStage: action === "start" ? "service_started" : "departed" }))
      .mockRejectedValue(new Error("Offline"));
    await renderWorkspace();
    await click(action === "start" ? "Start job" : "Clock out & complete");
    expect(container.textContent).toContain(action === "start" ? "Clock running" : "Job time saved");
    expect(container.textContent).toContain("Retry / refresh job clocks");
  });

  it("does not claim a clock is running when replayed start returns a finished clock", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(today()))
      .mockResolvedValueOnce(Response.json({ clock: finished, fieldStage: "departed" }))
      .mockRejectedValue(new Error("Offline"));
    await renderWorkspace();
    await click("Start job");
    expect(container.textContent).toContain("Your clock is stopped");
    expect(container.textContent).not.toContain("Your job clock is running");
  });

  it("reconciles a lost write response without sending another clock action", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(today()))
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValueOnce(Response.json(today([visit({ homeAtlasJobClock: running })])));
    await renderWorkspace();
    await click("Start job");
    expect(container.textContent).toContain("Clock-in confirmed");
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("uses the same action ID on uncertain retry and blocks rapid double taps", async () => {
    let complete!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(Response.json(today())).mockRejectedValueOnce(new Error("Offline"))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }))
      .mockResolvedValue(Response.json(today([visit({ homeAtlasJobClock: running })])));
    await renderWorkspace();
    await click("Start job");
    const start = button("Start job");
    await act(async () => { start.click(); start.click(); });
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[0][1].body).actionId).toBe(JSON.parse(posts[1][1].body).actionId);
    await act(async () => complete(Response.json({ clock: running })));
  });

  it("lets an initially failed Today load retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(Response.json(today()));
    await renderWorkspace();
    await click("Retry / refresh job clocks");
    expect(container.textContent).toContain("Test property");
  });

  it("keeps selected photos mounted across hide and reopen", async () => {
    fetchMock.mockResolvedValue(Response.json(today([visit({ homeAtlasJobClock: running })])));
    await renderWorkspace();
    await click("Photos & work notes");
    await click("Test selected photos: 0");
    await click("Hide field form");
    expect(button("Test selected photos: 1").closest("[hidden]")).not.toBeNull();
    await click("Before / after photos");
    expect(button("Test selected photos: 1").closest("[hidden]")).toBeNull();
  });

  it("directs a second job to the running job instead of starting overlapping time", async () => {
    fetchMock.mockResolvedValue(Response.json(today([visit({ homeAtlasJobClock: running }), visit({ projectionId: "projection-2", externalVisitId: "visit-2" })])));
    await renderWorkspace();
    expect(container.textContent).toContain("Another job clock is running");
    expect(Array.from(container.querySelectorAll("button")).some((element) => element.textContent?.includes("Start job"))).toBe(false);
  });

  it("refreshes on reconnection without unmounting an open photo form", async () => {
    fetchMock.mockImplementation(async () => Response.json(today([visit({ homeAtlasJobClock: running })])));
    await renderWorkspace();
    await click("Photos & work notes");
    await click("Test selected photos: 0");
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(button("Test selected photos: 1")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
