import { describe, expect, it } from "vitest";
import { calculateVisitPrice, quarterlyUpgradeMath } from "@/lib/membership/tier-config";
import {
  quarterlyNetAdvantageLine,
  quarterlyUpgradeSummary,
} from "@/lib/presentations/upgrade-copy";

const sqft = 2500;
const upgrade = quarterlyUpgradeMath(
  calculateVisitPrice("biannual", sqft),
  calculateVisitPrice("quarterly", sqft),
);

describe("quarterlyUpgradeSummary", () => {
  it("frames upgrade cost against treatment value, not plan price", () => {
    const summary = quarterlyUpgradeSummary(upgrade);

    expect(summary).toContain("added RainBlock + Hard Water treatment value");
    expect(summary).toContain("Bi-Annual is");
    expect(summary).toContain("Quarterly is");
    expect(summary).toContain("more than Bi-Annual");
    expect(summary).not.toMatch(/normally/i);
  });

  it("highlights net advantage when treatments exceed upgrade cost", () => {
    const line = quarterlyNetAdvantageLine(upgrade);

    if (upgrade.netAdvantage > 0) {
      expect(line).toContain("beyond the upgrade cost");
    }
  });
});
