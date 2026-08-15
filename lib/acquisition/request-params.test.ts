import { describe, expect, it } from "vitest";
import {
  buildLeadFormFromParams,
  estimatedPriceForLead,
  parseRequestSearchParams,
} from "./request-params";

describe("parseRequestSearchParams", () => {
  it("reads membership and sqft from query string", () => {
    const params = parseRequestSearchParams(
      new URLSearchParams("membership=quarterly&sqft=3200"),
    );

    expect(params.membershipTier).toBe("quarterly");
    expect(params.squareFootage).toBe(3200);
  });

  it("normalizes bi-annual aliases", () => {
    const params = parseRequestSearchParams(
      new URLSearchParams("membership=bi-annual"),
    );

    expect(params.membershipTier).toBe("biannual");
    expect(params.squareFootage).toBeNull();
  });
});

describe("buildLeadFormFromParams", () => {
  it("pre-selects membership service and tier note", () => {
    const form = buildLeadFormFromParams({
      membershipTier: "quarterly",
      squareFootage: 2500,
    });

    expect(form.membershipTier).toBe("quarterly");
    expect(form.servicesInterested).toContain("Full Home Care Membership");
    expect(form.notes).toContain("Quarterly");
  });
});

describe("estimatedPriceForLead", () => {
  it("returns the exterior-only visit price for tier and sqft", () => {
    expect(estimatedPriceForLead("quarterly", 2500)).toBe(250);
    expect(estimatedPriceForLead("biannual", 2500)).toBe(312);
  });

  it("returns null without a tier", () => {
    expect(estimatedPriceForLead(null, 2500)).toBeNull();
  });
});
