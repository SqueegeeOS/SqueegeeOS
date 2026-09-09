import { describe, expect, it } from "vitest";
import {
  chooseLiveDispatchReconciliationCandidate,
  normalizeLiveDispatchText,
  validateCreateLiveDispatchJobInput,
} from "./live-dispatch";

const id = "11111111-1111-4111-8111-111111111111";
const source = {
  assignmentId: id,
  clientName: "Barbara LaRue",
  serviceTitle: "Exterior Window Cleaning",
  propertyAddress: "123 Main St, Chico, CA",
  scheduledStart: "2026-09-08T22:00:00.000Z",
};
const candidate = {
  projectionId: "22222222-2222-4222-8222-222222222222",
  clientName: "Barbara LaRue",
  title: "Exterior Window Cleaning",
  propertyAddress: "123 Main St, Chico, CA",
  scheduledStart: "2026-09-08T22:30:00.000Z",
};

describe("live same-day dispatch", () => {
  it("validates an actionable same-day field job", () => {
    expect(
      validateCreateLiveDispatchJobInput({
        clientRequestId: id,
        technicianId: id,
        scheduledStart: "2026-09-08T22:00:00.000Z",
        clientName: "Barbara LaRue",
        serviceTitle: "Exterior windows",
        propertyAddress: "123 Main St, Chico, CA",
        soldAmountCents: 35000,
        notes: "Sold D2D and dispatched today.",
      }),
    ).toBeNull();
  });

  it("rejects malformed money and missing required identity", () => {
    expect(
      validateCreateLiveDispatchJobInput({
        clientRequestId: "bad",
        technicianId: id,
        scheduledStart: "not-a-date",
        clientName: "A",
        serviceTitle: "",
        soldAmountCents: -1,
      }),
    ).not.toBeNull();
  });

  it("normalizes human-entered matching text without fuzzy guessing", () => {
    expect(normalizeLiveDispatchText("  123 Main St., CHICO CA ")).toBe(
      "123 main st chico ca",
    );
  });

  it("links one strong address match", () => {
    expect(
      chooseLiveDispatchReconciliationCandidate(source, [candidate]),
    ).toEqual(candidate);
  });

  it("refuses ambiguous matches instead of risking a duplicate or wrong customer", () => {
    expect(
      chooseLiveDispatchReconciliationCandidate(source, [
        candidate,
        { ...candidate, projectionId: "33333333-3333-4333-8333-333333333333" },
      ]),
    ).toBeNull();
  });

  it("requires exact service title when HQ did not enter an address", () => {
    expect(
      chooseLiveDispatchReconciliationCandidate(
        { ...source, propertyAddress: null },
        [{ ...candidate, title: "Gutter cleaning", propertyAddress: null }],
      ),
    ).toBeNull();
    expect(
      chooseLiveDispatchReconciliationCandidate(
        { ...source, propertyAddress: null },
        [{ ...candidate, propertyAddress: null }],
      ),
    ).toEqual({ ...candidate, propertyAddress: null });
  });
});
