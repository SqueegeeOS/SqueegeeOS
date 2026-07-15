import { describe, expect, it } from "vitest";
import { storedEvidenceMatches } from "./verify-storage-evidence";

describe("signed storage evidence", () => {
  it("accepts exact duplicate bytes and rejects unknown or conflicting bytes", () => {
    expect(storedEvidenceMatches(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(true);
    expect(storedEvidenceMatches(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBe(false);
    expect(storedEvidenceMatches(Uint8Array.of(1, 2), Uint8Array.of(1))).toBe(false);
  });
});
