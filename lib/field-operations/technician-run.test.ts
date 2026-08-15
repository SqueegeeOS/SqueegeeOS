import { describe, expect, it } from "vitest";
import {
  filterTechnicianVisits,
  listTechnicianCrew,
  resolveTechnicianVisitReadiness,
  selectTechnicianNextAction,
  summarizeTechnicianRun,
  TECHNICIAN_ALL_CREW,
  TECHNICIAN_UNASSIGNED_CREW,
  technicianCrewSelection,
} from "./technician-run";

function visit(overrides: Record<string, unknown> = {}) {
  return {
    isComplete: false,
    scheduledStart: "2026-08-14T16:00:00.000Z",
    homeAtlasPropertyId: "property-1",
    homeAtlasAppointmentId: "appointment-1",
    homeAtlasFieldRecordCount: 0,
    homeAtlasCustomerVisibleRecordCount: 0,
    ...overrides,
  };
}

describe("technician run automation", () => {
  it("fails closed until Jobber and HomeAtlas have a safe visit pair", () => {
    expect(
      resolveTechnicianVisitReadiness(
        visit({ homeAtlasPropertyId: null }),
        true,
      ),
    ).toBe("pairing_required");
    expect(
      resolveTechnicianVisitReadiness(
        visit({ homeAtlasAppointmentId: null }),
        true,
      ),
    ).toBe("appointment_syncing");
    expect(resolveTechnicianVisitReadiness(visit(), false)).toBe(
      "proof_unavailable",
    );
  });

  it("keeps a Jobber-complete visit open until HomeAtlas proof is complete", () => {
    expect(
      resolveTechnicianVisitReadiness(visit({ isComplete: true }), true),
    ).toBe("closeout_required");
    expect(
      resolveTechnicianVisitReadiness(
        visit({ isComplete: true, homeAtlasFieldRecordCount: 1 }),
        true,
      ),
    ).toBe("portal_update_required");
    expect(
      resolveTechnicianVisitReadiness(
        visit({
          isComplete: true,
          homeAtlasFieldRecordCount: 1,
          homeAtlasCustomerVisibleRecordCount: 1,
        }),
        true,
      ),
    ).toBe("complete");
  });

  it("summarizes only fully closed visits as complete", () => {
    expect(
      summarizeTechnicianRun(
        [
          visit(),
          visit({ isComplete: true }),
          visit({
            isComplete: true,
            homeAtlasFieldRecordCount: 1,
            homeAtlasCustomerVisibleRecordCount: 1,
          }),
        ],
        true,
      ),
    ).toEqual({
      total: 3,
      ready: 1,
      complete: 1,
      actionRequired: 1,
      documented: 1,
    });
  });

  it("prioritizes unfinished closeout before the next scheduled stop", () => {
    const nextStop = visit({
      id: "next",
      scheduledStart: "2026-08-14T17:00:00.000Z",
    });
    const missedCloseout = visit({
      id: "closeout",
      isComplete: true,
      scheduledStart: "2026-08-14T15:00:00.000Z",
    });
    expect(
      selectTechnicianNextAction([nextStop, missedCloseout], true),
    ).toMatchObject({ id: "closeout" });
  });

  it("turns mirrored Jobber assignments into stable crew route lenses", () => {
    const visits = [
      {
        id: "one",
        assignmentReadState: "available" as const,
        assignedUsers: [{ id: "alex", name: "Alex Rivera" }],
      },
      {
        id: "two",
        assignmentReadState: "available" as const,
        assignedUsers: [
          { id: "alex", name: "Alex Rivera" },
          { id: "sam", name: "Sam Lee" },
        ],
      },
      {
        id: "three",
        assignmentReadState: "available" as const,
        assignedUsers: [],
      },
      {
        id: "unknown",
        assignmentReadState: "permission_hidden" as const,
        assignedUsers: [],
      },
    ];

    expect(listTechnicianCrew(visits)).toEqual([
      { id: "alex", name: "Alex Rivera", stopCount: 2 },
      { id: "sam", name: "Sam Lee", stopCount: 1 },
    ]);
    expect(
      filterTechnicianVisits(visits, technicianCrewSelection("alex")).map(
        (candidate) => candidate.id,
      ),
    ).toEqual(["one", "two"]);
    expect(
      filterTechnicianVisits(visits, TECHNICIAN_UNASSIGNED_CREW).map(
        (candidate) => candidate.id,
      ),
    ).toEqual(["three"]);
    expect(filterTechnicianVisits(visits, TECHNICIAN_ALL_CREW)).toBe(visits);
  });
});
