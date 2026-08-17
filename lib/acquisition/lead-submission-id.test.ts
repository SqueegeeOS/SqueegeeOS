import { describe, expect, it } from "vitest";
import {
  createLeadSubmissionId,
  isLeadSubmissionId,
} from "./lead-submission-id";

describe("public lead submission identity", () => {
  it("creates a database-safe UUID for one browser submission", () => {
    const id = createLeadSubmissionId();

    expect(isLeadSubmissionId(id)).toBe(true);
  });

  it("rejects missing, malformed, and padded identifiers", () => {
    expect(isLeadSubmissionId(undefined)).toBe(false);
    expect(isLeadSubmissionId("retry-me")).toBe(false);
    expect(
      isLeadSubmissionId(" 00000000-0000-4000-8000-000000000081 "),
    ).toBe(true);
  });
});
