import { describe, expect, it } from "vitest";
import { buildStructuredQuoteSummary, memberSavingsQuoteLine } from "./format";

describe("buildStructuredQuoteSummary", () => {
  it("includes window care, add-ons, member discount, and total", () => {
    const text = buildStructuredQuoteSummary({
      sqft: 2200,
      frequency: "quarterly",
      windowCareVisitPrice: 164,
      frequencyLabel: "Every 3 months",
      addOns: {
        lineItems: [
          {
            id: "soft_wash_exterior",
            label: "Soft Wash — Exterior",
            listAmount: 250,
            amount: 187.5,
            detail: "Flat rate",
            memberDiscountPercent: 25,
          },
          {
            id: "moss_removal",
            label: "Moss Removal",
            listAmount: 240,
            amount: 180,
            detail: "400 sq ft affected · $0.60/sq ft",
            memberDiscountPercent: 25,
          },
        ],
        listSubtotal: 490,
        subtotal: 367.5,
        memberDiscountPercent: 25,
        memberSavings: 122.5,
      },
    });

    expect(text).toContain("Home Care Plan — Quarterly");
    expect(text).toContain("2,200 sq ft");
    expect(text).toContain("Window Care");
    expect(text).toContain("$164");
    expect(text).toContain("Moss Removal (400 sq ft)");
    expect(text).toContain("You save $122.50 as a Quarterly member.");
    expect(text).toContain("Your Member Price");
    expect(text).toContain("$367.50");
    expect(text).toContain("Total Estimate");
    expect(text).toContain("$531.50");
  });

  it("formats the member savings sales line", () => {
    expect(memberSavingsQuoteLine("quarterly", 122.5)).toBe(
      "You save $122.50 as a Quarterly member.",
    );
    expect(memberSavingsQuoteLine("bi_annual", 98)).toBe(
      "You save $98 as a Bi-Annual member.",
    );
    expect(memberSavingsQuoteLine("quarterly", 0)).toBeNull();
  });
});
