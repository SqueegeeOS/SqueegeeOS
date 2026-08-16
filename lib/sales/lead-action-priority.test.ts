import { describe, expect, it } from "vitest";
import type { SalesRepLead } from "./workspace-types";
import {
  buildSalesLeadActionQueue,
  classifySalesLeadAction,
  summarizeSalesLeadActionQueue,
} from "./lead-action-priority";

const BASE_LEAD: SalesRepLead = {
  id: "lead-base",
  leadIntakeId: null,
  fullName: "Homeowner",
  propertyAddress: "100 Main Street",
  phone: null,
  email: null,
  status: "follow_up",
  source: "door_to_door",
  estimatedArrCents: 120_000,
  nextFollowUpAt: null,
  notes: "",
  smsConsentStatus: "unknown",
  emailConsentStatus: "unknown",
  recentInteractions: [],
  createdAt: "2026-08-14T16:00:00.000Z",
  updatedAt: "2026-08-14T16:00:00.000Z",
};

function lead(
  id: string,
  nextFollowUpAt: string | null,
  overrides: Partial<SalesRepLead> = {},
): SalesRepLead {
  return { ...BASE_LEAD, id, nextFollowUpAt, ...overrides };
}

describe("David field next-action priority", () => {
  const reference = new Date("2026-08-15T00:00:00.000Z"); // Aug 14, 5 PM Pacific

  it("uses the Pacific business day while separating overdue work", () => {
    expect(
      classifySalesLeadAction(
        lead("past", "2026-08-14T23:30:00.000Z"),
        reference,
      ),
    ).toBe("overdue");
    expect(
      classifySalesLeadAction(
        lead("today", "2026-08-15T01:00:00.000Z"),
        reference,
      ),
    ).toBe("due_today");
    expect(
      classifySalesLeadAction(
        lead("tomorrow", "2026-08-15T18:00:00.000Z"),
        reference,
      ),
    ).toBe("upcoming");
    expect(classifySalesLeadAction(lead("none", null), reference)).toBe(
      "unscheduled",
    );
  });

  it("ranks overdue, today, missing-next-move, then future leads", () => {
    const queue = buildSalesLeadActionQueue(
      [
        lead("future", "2026-08-16T18:00:00.000Z"),
        lead("missing-old", null, {
          updatedAt: "2026-08-13T16:00:00.000Z",
        }),
        lead("today", "2026-08-15T01:00:00.000Z"),
        lead("overdue", "2026-08-14T22:00:00.000Z"),
        lead("missing-new", null, {
          updatedAt: "2026-08-14T20:00:00.000Z",
        }),
      ],
      reference,
    );

    expect(queue.map((item) => item.lead.id)).toEqual([
      "overdue",
      "today",
      "missing-new",
      "missing-old",
      "future",
    ]);
    expect(summarizeSalesLeadActionQueue(queue)).toEqual({
      overdue: 1,
      due_today: 1,
      unscheduled: 2,
      upcoming: 1,
    });
  });

  it("keeps completed outcomes out of the working queue", () => {
    const queue = buildSalesLeadActionQueue(
      [
        lead("open", null),
        lead("signed", null, { status: "signed" }),
        lead("won", null, { status: "won" }),
        lead("lost", null, { status: "lost" }),
      ],
      reference,
    );
    expect(queue.map((item) => item.lead.id)).toEqual(["open"]);
  });
});
