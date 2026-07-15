import { describe, expect, it } from "vitest";
import { emptyHomeCarePlanDraft } from "./create-types";
import { parseHomeCarePlanDraft } from "./authority-input";

function validDraft() {
  return {
    ...emptyHomeCarePlanDraft,
    homeowner: {
      ...emptyHomeCarePlanDraft.homeowner,
      fullName: "Disposable Test Homeowner",
      email: "test@example.com",
    },
    property: {
      ...emptyHomeCarePlanDraft.property,
      name: "Disposable Test Home",
      address: "1 Test Way",
    },
  };
}

describe("Home Care Plan authority input", () => {
  it("accepts the existing complete authoring draft", () => {
    expect(parseHomeCarePlanDraft(validDraft())).toEqual(validDraft());
  });

  it("rejects unknown fields, malformed contacts, and oversized findings", () => {
    expect(parseHomeCarePlanDraft({ ...validDraft(), price: 1 })).toBeNull();
    expect(
      parseHomeCarePlanDraft({
        ...validDraft(),
        homeowner: { ...validDraft().homeowner, email: "not-an-email" },
      }),
    ).toBeNull();
    expect(
      parseHomeCarePlanDraft({
        ...validDraft(),
        findings: Array.from({ length: 25 }, (_, index) => ({
          id: String(index),
          title: "Finding",
          severity: "Attention",
          description: "Description",
          image: "",
        })),
      }),
    ).toBeNull();
  });

  it("rejects unverified last-visit authority", () => {
    expect(
      parseHomeCarePlanDraft({
        ...validDraft(),
        property: { ...validDraft().property, lastVisit: "June 24, 2026" },
      }),
    ).toBeNull();
  });
});
