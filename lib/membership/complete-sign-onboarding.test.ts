import { describe, expect, it } from "vitest";
import { isSignOnboardingAlreadyComplete } from "./complete-sign-onboarding";

describe("isSignOnboardingAlreadyComplete", () => {
  it("is true only when signed with both membership and agreement ids", () => {
    expect(
      isSignOnboardingAlreadyComplete({
        status: "signed",
        membershipId: "m-1",
        agreementId: "a-1",
      }),
    ).toBe(true);
  });

  it("is false when agreement is missing", () => {
    expect(
      isSignOnboardingAlreadyComplete({
        status: "signed",
        membershipId: "m-1",
        agreementId: null,
      }),
    ).toBe(false);
  });

  it("is false when still draft", () => {
    expect(
      isSignOnboardingAlreadyComplete({
        status: "draft",
        membershipId: "m-1",
        agreementId: "a-1",
      }),
    ).toBe(false);
  });
});
