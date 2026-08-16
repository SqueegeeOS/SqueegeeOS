import { describe, expect, it } from "vitest";
import type { SalesLeadActionQueueItem } from "./lead-action-priority";
import { filterSalesLeadActionQueue } from "./lead-action-filter";
import type { SalesRepLead } from "./workspace-types";

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
  notes: "Private context is intentionally not indexed.",
  smsConsentStatus: "unknown",
  emailConsentStatus: "unknown",
  createdAt: "2026-08-14T16:00:00.000Z",
  updatedAt: "2026-08-14T16:00:00.000Z",
};

function item(
  id: string,
  moment: SalesLeadActionQueueItem["moment"],
  lead: Partial<SalesRepLead> = {},
): SalesLeadActionQueueItem {
  return {
    moment,
    lead: { ...BASE_LEAD, id, ...lead },
  };
}

const QUEUE = [
  item("overdue", "overdue", {
    fullName: "José Mason",
    propertyAddress: "1420 Davis Avenue",
    phone: "(530) 555-0100",
    email: "jose@example.com",
  }),
  item("today", "due_today", {
    fullName: "Mandi Rivera",
    propertyAddress: "88 Oak Way",
  }),
  item("missing", "unscheduled", {
    fullName: "Joani Wells",
    propertyAddress: "701 Pine Road",
  }),
  item("future", "upcoming", {
    fullName: "Jeff Mason",
    propertyAddress: "44 Cedar Court",
  }),
];

describe("sales lead action queue filters", () => {
  it("keeps the full priority order when no filter is active", () => {
    expect(
      filterSalesLeadActionQueue(QUEUE, { filter: "all", query: "" }).map(
        ({ lead }) => lead.id,
      ),
    ).toEqual(["overdue", "today", "missing", "future"]);
  });

  it("collects overdue, today, and unscheduled leads into needs action", () => {
    expect(
      filterSalesLeadActionQueue(QUEUE, {
        filter: "needs_action",
        query: "",
      }).map(({ lead }) => lead.id),
    ).toEqual(["overdue", "today", "missing"]);
  });

  it("supports exact urgency filters", () => {
    expect(
      filterSalesLeadActionQueue(QUEUE, {
        filter: "due_today",
        query: "",
      }).map(({ lead }) => lead.id),
    ).toEqual(["today"]);
  });

  it("matches name, address, phone, and email without indexing notes", () => {
    for (const query of ["jose davis", "530 555", "jose@example.com"]) {
      expect(
        filterSalesLeadActionQueue(QUEUE, { filter: "all", query }).map(
          ({ lead }) => lead.id,
        ),
      ).toEqual(["overdue"]);
    }
    expect(
      filterSalesLeadActionQueue(QUEUE, {
        filter: "all",
        query: "private context",
      }),
    ).toEqual([]);
  });

  it("combines search and urgency without mutating queue order", () => {
    expect(
      filterSalesLeadActionQueue(QUEUE, {
        filter: "needs_action",
        query: "mason",
      }).map(({ lead }) => lead.id),
    ).toEqual(["overdue"]);
    expect(QUEUE.map(({ lead }) => lead.id)).toEqual([
      "overdue",
      "today",
      "missing",
      "future",
    ]);
  });
});
