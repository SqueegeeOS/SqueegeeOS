import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { jobberFieldCustomerPhones } from "./field-customer-phone";
import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), board: vi.fn(), from: vi.fn(), live: vi.fn(), reconcile: vi.fn(),
}));
vi.mock("@/lib/field-operations/field-access", () => ({ authorizeFieldRequest: mocks.authorize }));
vi.mock("@/lib/care-operations/jobber-today", () => ({ loadJobberTodayBoard: mocks.board }));
vi.mock("@/lib/field-operations/live-dispatch-server", () => ({
  loadPendingLiveFieldVisits: mocks.live, reconcilePendingLiveDispatchJobs: mocks.reconcile,
}));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({ from: mocks.from }),
}));
import { GET as today } from "@/app/api/field/today/route";
import { GET as upcoming } from "@/app/api/field/upcoming/route";

const tyler = "homeatlas:" + TYLER_GERMANY_TECHNICIAN_ID;
const someoneElse = "homeatlas:another-tech";
const request = () => new Request("https://example.test/api/field");
const base = { connection_id: JOBBER_CONNECTION_ID, provider: "jobber" };
function visit(id: string, who = tyler): JobberTodayVisit {
  return {
    projectionId: id, externalVisitId: "visit-" + id, clientName: "Household " + id,
    isComplete: false, visitStatus: "SCHEDULED", scheduledStart: new Date(Date.now() + 3 * 86400000).toISOString(),
    homeAtlasFieldAssignmentId: "assignment-" + id, homeAtlasAssignedTechnicianId: who,
    assignedUsers: [{ id: tyler, name: "Prior Jobber crew" }], assignmentReadState: "available",
    homeAtlasFieldStage: "not_started", homeAtlasFieldRecordCount: 0,
  } as JobberTodayVisit;
}
function visitKey(id: string, overrides: Record<string, unknown> = {}) {
  return {
    ...base, id, external_visit_id: "visit-" + id, external_client_id: "client-" + id,
    external_property_id: "property-" + id, visit_status: "SCHEDULED",
    native_assignment: { id: "assignment-" + id, technician_id: TYLER_GERMANY_TECHNICIAN_ID, connection_id: JOBBER_CONNECTION_ID },
    ...overrides,
  };
}
function client(id: string, overrides: Record<string, unknown> = {}) {
  return { ...base, external_client_id: "client-" + id, phone: "(530) 555-0101",
    is_archived: false, properties: [{ id: "property-" + id }], ...overrides };
}

let visitRows: ReturnType<typeof visitKey>[];
let clientRows: ReturnType<typeof client>[];
let clientError: boolean;
const requested = new Map<string, string[]>();
beforeEach(() => {
  vi.resetAllMocks();
  requested.clear();
  clientError = false;
  mocks.authorize.mockResolvedValue({ kind: "technician", jobberUserId: tyler });
  mocks.board.mockResolvedValue({ visits: [visit("mine"), visit("theirs", someoneElse)], fieldFollowUps: [] });
  mocks.live.mockResolvedValue([]);
  mocks.reconcile.mockResolvedValue({ reconciled: 0 });
  visitRows = [visitKey("mine"), visitKey("theirs")];
  clientRows = [client("mine"), client("theirs", { phone: "5305550109" })];
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn((_column: string, ids: string[]) => {
        requested.set(table, ids);
        // Return the synthetic rows even when unrequested to verify the DTO
        // guard does not rely solely on the datastore's filtering.
        return Promise.resolve(table === "jobber_visit_projections"
          ? { data: visitRows, error: null }
          : { data: clientRows, error: clientError ? new Error("private detail") : null });
      }),
    };
    return chain;
  });
});

describe.each([["Today", today], ["Upcoming", upcoming]] as const)("%s assigned job phone privacy", (_name, get) => {
  it("returns only the matched client's phone(s), with private cache control", async () => {
    clientRows = [client("mine", { phones: [
      { number: "5305550101", primary: true },
      { number: "5305550102", primary: false },
      { number: "javascript:alert(1)", primary: false },
    ] }), client("theirs", { phone: "5305550109" })];
    const response = await get(request());
    const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.visits).toHaveLength(1);
    expect(body.visits[0].customerPhones).toEqual([
      { number: "+15305550101", primary: true },
      { number: "+15305550102", primary: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/5550109|javascript|client-mine/);
    expect(requested.get("jobber_visit_projections")).toEqual(["mine"]);
    expect(requested.get("jobber_client_projections")).toEqual(["client-mine"]);
  });

  it("omits contacts on a native reassignment that happens after the board read", async () => {
    visitRows = [visitKey("mine", { native_assignment: {
      id: "assignment-mine", technician_id: "another-tech", connection_id: JOBBER_CONNECTION_ID,
    } })];
    const body = await (await get(request())).json();
    expect(body.visits[0].customerPhones).toEqual([]);
    expect(requested.has("jobber_client_projections")).toBe(false);
  });

  it.each([
    { connection_id: "different-account" },
    { properties: [{ id: "different-property" }] },
    { is_archived: true },
    { phone: "not a phone" },
  ])("omits an unsafe or incomplete client projection", async (override) => {
    clientRows = [client("mine", override)];
    const response = await get(request());
    expect((await response.json()).visits[0].customerPhones).toEqual([]);
  });

  it("requires Tyler's stable authenticated identity and never looks up phones for HQ or others", async () => {
    for (const actor of [null, { kind: "admin" }, { kind: "technician", jobberUserId: someoneElse, displayName: "Tyler Germany" }]) {
      mocks.authorize.mockResolvedValue(actor);
      const body = await (await get(request())).json();
      expect(JSON.stringify(body)).not.toContain("customerPhones");
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("keeps the route usable when the contact read fails", async () => {
    clientError = true;
    const response = await get(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.visits[0].customerPhones).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("private detail");
  });
});

it("normalizes common legacy and international phone forms without accepting dial strings or extensions", () => {
  expect(jobberFieldCustomerPhones("1 (530) 555-0101", [
    { number: "530.555.0101", primary: false }, { number: "+44 20 7946 0958", primary: false },
    { number: "5305550103,99", primary: false }, { number: "0000000000", primary: false },
    { number: "+15305550104;ext=33", primary: false },
  ])).toEqual([{ number: "+15305550101", primary: true }, { number: "+442079460958", primary: false }]);
});
