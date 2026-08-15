import { describe, expect, it } from "vitest";
import { selectAuthoritativeSalesLeadPresentation } from "./sales-lead-presentation";

describe("authoritative presentation selection for one sales lead", () => {
  it("prefers a signed legal outcome over a newer stray draft", () => {
    expect(
      selectAuthoritativeSalesLeadPresentation([
        {
          id: "newer-draft",
          status: "draft" as const,
          updatedAt: "2026-08-14T20:00:00.000Z",
        },
        {
          id: "signed-outcome",
          status: "signed" as const,
          updatedAt: "2026-08-14T19:00:00.000Z",
        },
      ])?.id,
    ).toBe("signed-outcome");
  });

  it("resumes the newest active presentation when nothing is signed", () => {
    expect(
      selectAuthoritativeSalesLeadPresentation([
        {
          id: "older-presented",
          status: "presented" as const,
          updatedAt: "2026-08-14T18:00:00.000Z",
        },
        {
          id: "newer-draft",
          status: "draft" as const,
          updatedAt: "2026-08-14T20:00:00.000Z",
        },
      ])?.id,
    ).toBe("newer-draft");
  });

  it("returns null when no presentation exists", () => {
    expect(selectAuthoritativeSalesLeadPresentation([])).toBeNull();
  });
});
