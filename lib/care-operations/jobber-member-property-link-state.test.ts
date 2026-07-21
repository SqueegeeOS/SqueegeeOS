import { describe, expect, it } from "vitest";
import {
  advanceJobberPaginationCursor,
  appendUniqueJobberRecords,
  createJobberRequestGenerationGuard,
  hasCompleteJobberPropertyOwnershipEvidence,
  memberPropertyFilterChange,
} from "../../components/admin/jobber-member-property-link-state";

describe("Jobber member-property link selection state", () => {
  it("clears the selected membership and confirmation whenever filtering changes", () => {
    expect(memberPropertyFilterChange("new address")).toEqual({
      memberFilter: "new address",
      selectedMembershipId: "",
      samePropertyConfirmed: false,
    });
  });

  it("appends customer or property pages without replaying IDs", () => {
    expect(
      appendUniqueJobberRecords(
        [{ id: "one", label: "first" }],
        [
          { id: "one", label: "replayed" },
          { id: "two", label: "second" },
        ],
      ),
    ).toEqual([
      { id: "one", label: "first" },
      { id: "two", label: "second" },
    ]);
  });

  it("advances opaque cursors and fails closed on replay", () => {
    const first = advanceJobberPaginationCursor({
      requestedAfter: null,
      endCursor: "cursor-1",
      hasNextPage: true,
      seenCursors: [],
    });
    expect(first).toEqual({
      after: "cursor-1",
      hasNextPage: true,
      seenCursors: ["cursor-1"],
    });
    expect(() =>
      advanceJobberPaginationCursor({
        requestedAfter: "cursor-2",
        endCursor: "cursor-1",
        hasNextPage: true,
        seenCursors: ["cursor-1", "cursor-2"],
      }),
    ).toThrow(/repeated or omitted/);
  });

  it("requires complete browsing within the unchanged ownership proof bound", () => {
    expect(
      hasCompleteJobberPropertyOwnershipEvidence({
        pagesLoaded: 10,
        hasNextPage: false,
        ownershipProofPageLimit: 10,
      }),
    ).toBe(true);
    expect(
      hasCompleteJobberPropertyOwnershipEvidence({
        pagesLoaded: 10,
        hasNextPage: true,
        ownershipProofPageLimit: 10,
      }),
    ).toBe(false);
    expect(
      hasCompleteJobberPropertyOwnershipEvidence({
        pagesLoaded: 11,
        hasNextPage: false,
        ownershipProofPageLimit: 10,
      }),
    ).toBe(false);
  });

  it("ignores an out-of-order customer-search response after query reset", () => {
    const guard = createJobberRequestGenerationGuard();
    const searchGeneration = guard.begin();
    guard.invalidate();

    let visibleClient = "reset";
    let searching = false;
    if (guard.isCurrent(searchGeneration)) visibleClient = "stale client";
    if (guard.isCurrent(searchGeneration)) searching = false;

    expect(visibleClient).toBe("reset");
    expect(searching).toBe(false);
  });

  it("ignores an out-of-order property response and finally after a competing client selection", () => {
    const guard = createJobberRequestGenerationGuard();
    const firstClientGeneration = guard.begin();
    const secondClientGeneration = guard.begin();

    let selectedProperty = "second-client-property";
    let loadingSecondClient = true;
    if (guard.isCurrent(firstClientGeneration)) {
      selectedProperty = "first-client-property";
    }
    if (guard.isCurrent(firstClientGeneration)) loadingSecondClient = false;

    expect(guard.isCurrent(secondClientGeneration)).toBe(true);
    expect(selectedProperty).toBe("second-client-property");
    expect(loadingSecondClient).toBe(true);
  });
});
