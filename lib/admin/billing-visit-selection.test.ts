import { describe, expect, it } from "vitest";
import {
  selectBillingWorkspaceVisit,
  type CompletedVisitBillingEvidence,
} from "./billing-visit-selection";

function evidence(
  overrides: Partial<CompletedVisitBillingEvidence> = {},
): CompletedVisitBillingEvidence {
  return {
    hasFieldRecord: true,
    hasCustomerVisibleUpdate: true,
    hasOpenFollowUp: false,
    ...overrides,
  };
}

describe("billing visit selection", () => {
  it("keeps a finished current-month visit attached to owner payment review", () => {
    const selected = selectBillingWorkspaceVisit({
      candidates: [
        {
          id: "future",
          scheduledAt: "2026-09-12T16:00:00.000Z",
          status: "scheduled",
        },
        {
          id: "finished",
          scheduledAt: "2026-08-21T16:00:00.000Z",
          status: "completed",
        },
      ],
      completedEvidenceByAppointmentId: new Map([
        ["finished", evidence()],
      ]),
      currentServiceMonth: "2026-08-01",
    });

    expect(selected?.id).toBe("finished");
  });

  it("never promotes a completed visit with private-only proof or an exception", () => {
    const candidates = [
      {
        id: "finished",
        scheduledAt: "2026-08-21T16:00:00.000Z",
        status: "completed",
      },
      {
        id: "future",
        scheduledAt: "2026-09-12T16:00:00.000Z",
        status: "scheduled",
      },
    ];

    expect(
      selectBillingWorkspaceVisit({
        candidates,
        completedEvidenceByAppointmentId: new Map([
          ["finished", evidence({ hasCustomerVisibleUpdate: false })],
        ]),
        currentServiceMonth: "2026-08-01",
      })?.id,
    ).toBe("future");
    expect(
      selectBillingWorkspaceVisit({
        candidates,
        completedEvidenceByAppointmentId: new Map([
          ["finished", evidence({ hasOpenFollowUp: true })],
        ]),
        currentServiceMonth: "2026-08-01",
      })?.id,
    ).toBe("future");
  });

  it("does not revive a finished visit from a prior service month", () => {
    const selected = selectBillingWorkspaceVisit({
      candidates: [
        {
          id: "old",
          scheduledAt: "2026-07-21T16:00:00.000Z",
          status: "completed",
        },
      ],
      completedEvidenceByAppointmentId: new Map([["old", evidence()]]),
      currentServiceMonth: "2026-08-01",
    });

    expect(selected).toBeNull();
  });
});
