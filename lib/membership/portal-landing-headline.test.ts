import { describe, expect, it } from "vitest";
import { buildPortalLandingHeadline } from "./portal-landing-headline";

describe("buildPortalLandingHeadline", () => {
  it("greets by first name without repeating full name", () => {
    expect(
      buildPortalLandingHeadline({
        firstName: "Sylvia",
        fullName: "Sylvia Siegel",
      }),
    ).toBe("Sylvia, your home is under care.");
  });

  it("extracts first name from full name when first name is missing", () => {
    expect(
      buildPortalLandingHeadline({
        firstName: null,
        fullName: "Larry Buckley",
      }),
    ).toBe("Larry, your home is under care.");
  });

  it("uses full name when no usable first name exists", () => {
    expect(
      buildPortalLandingHeadline({
        firstName: null,
        fullName: "A. Nonprofit Trust",
      }),
    ).toBe("A. Nonprofit Trust is under care.");
  });

  it("falls back when names are missing or placeholders", () => {
    expect(buildPortalLandingHeadline({ firstName: null, fullName: null })).toBe(
      "Your home is under care.",
    );
    expect(
      buildPortalLandingHeadline({ firstName: "Member", fullName: "Member" }),
    ).toBe("Your home is under care.");
  });
});
