import { describe, expect, it } from "vitest";
import { calculateVisitPrice, quarterlyUpgradeMath } from "@/lib/membership/tier-config";
import {
  quarterlyComplimentaryLine,
  quarterlyNetAdvantageLine,
  quarterlySavingsLine,
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

describe("quarterly customer copy", () => {
  it("leads with savings and complimentary services in plain English", () => {
    const savings = quarterlySavingsLine(upgrade);
    const complimentary = quarterlyComplimentaryLine(upgrade);

    if (upgrade.netAdvantage > 0) {
      expect(savings).toContain("save approximately");
      expect(savings).toContain("paying for these treatments separately");
      expect(complimentary).toMatch(/^Plus, you receive/);
    }

    expect(complimentary).toContain("complimentary services");
    expect(complimentary).toContain("RainBlock Technology");
    expect(complimentary).toContain("Hard Water Removal");
    expect(complimentary).not.toContain("net value");
  });
});
