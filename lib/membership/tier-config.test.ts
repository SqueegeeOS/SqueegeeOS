import { describe, expect, it } from "vitest";
import {
  buildSqueegeeKingTierQuotes,
  formatTierPrice,
  membershipRequestHref,
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
