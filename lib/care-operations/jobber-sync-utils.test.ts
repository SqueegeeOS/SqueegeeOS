import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  chunkItems,
  escapeLikePattern,
  summarizeProjectionChanges,
  toBoundedInteger,
} from "./jobber-sync-utils";

describe("Jobber synchronization helpers", () => {
  it("chunks large sync payloads without dropping records", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("builds one normalized searchable value", () => {
    expect(buildSearchText(["  Ada Lovelace ", "ADA@EXAMPLE.COM", 42])).toBe(
      "ada lovelace ada@example.com 42",
    );
  });

  it("escapes Postgres wildcard characters", () => {
    expect(escapeLikePattern("A_100%\\B")).toBe("A\\_100\\%\\\\B");
  });

  it("normalizes pagination input without allowing NaN or extreme values", () => {
    expect(toBoundedInteger(Number.NaN, 20, 1, 50)).toBe(20);
    expect(toBoundedInteger(-4, 20, 1, 50)).toBe(1);
    expect(toBoundedInteger(500, 20, 1, 50)).toBe(50);
    expect(toBoundedInteger(7.9, 20, 1, 50)).toBe(7);
  });

  it("classifies inserted, changed, and unchanged projections", () => {
    expect(
      summarizeProjectionChanges(
        [
          { externalId: "new", payloadHash: "a" },
          { externalId: "changed", payloadHash: "b" },
          { externalId: "same", payloadHash: "c" },
        ],
        new Map([
          ["changed", "old"],
          ["same", "c"],
        ]),
      ),
    ).toEqual({ inserted: 1, changed: 1, unchanged: 1 });
  });
});
