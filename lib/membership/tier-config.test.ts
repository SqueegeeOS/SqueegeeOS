import { describe, expect, it } from "vitest";
import {
  buildSqueegeeKingTierQuotes,
  calculateAnnualFromVisits,
  calculateVisitPrice,
  formatTierPrice,
  membershipRequestHref,
  normalizeToSqueegeeKingTier,
} from "./tier-config";

describe("SqueegeeKing tier quotes", () => {
  it("builds aligned quarterly and bi-annual comparison rows", () => {
    const [quarterly, biannual] = buildSqueegeeKingTierQuotes(2500);

    expect(quarterly.label).toBe("Quarterly");
    expect(biannual.label).toBe("Bi-Annual");
    expect(quarterly.frequency).toBe("Every 3 months");
    expect(biannual.frequency).toBe("Every 6 months");
    expect(quarterly.rainblockIncluded).toBe(true);
    expect(biannual.rainblockIncluded).toBe(false);
    expect(quarterly.addonDiscount).toBe(25);
    expect(biannual.addonDiscount).toBe(20);
    expect(quarterly.periodPriceLabel).toMatch(/\/quarter$/);
    expect(biannual.periodPriceLabel).toMatch(/bi-annually$/);
    expect(quarterly.highlighted).toBe(true);
  });

  it("links tier CTAs to the request form", () => {
    expect(membershipRequestHref("quarterly")).toBe("/request?membership=quarterly");
    expect(membershipRequestHref("biannual")).toBe("/request?membership=biannual");
    expect(membershipRequestHref("quarterly", 3200)).toBe(
      "/request?membership=quarterly&sqft=3200",
    );
  });
});

describe("formatTierPrice", () => {
  it("formats a plain number with a single dollar sign", () => {
    expect(formatTierPrice(300)).toBe("$300");
  });

  it("does not double-prefix an already-formatted price string", () => {
    // Real production bug: a stale record passed "$300" (string) through
    // here, and `"$300".toLocaleString()` is a no-op, producing "$$300".
    expect(formatTierPrice("$300" as unknown as number)).toBe("$300");
  });
});

describe("optional 3x/year presentation cadence", () => {
  it("prices between the two primary plans and annualizes three visits", () => {
    const quarterly = calculateVisitPrice("quarterly", 2500);
    const triannual = calculateVisitPrice("triannual", 2500);
    const biannual = calculateVisitPrice("biannual", 2500);

    expect(triannual).toBeGreaterThan(quarterly);
    expect(triannual).toBeLessThan(biannual);
    expect(calculateAnnualFromVisits("triannual", triannual)).toBe(
      triannual * 3,
    );
  });

  it("recognizes the common ways a 3x/year deal may be stored", () => {
    expect(normalizeToSqueegeeKingTier("tri-annual")).toBe("triannual");
    expect(normalizeToSqueegeeKingTier("3x per year")).toBe("triannual");
  });
});
