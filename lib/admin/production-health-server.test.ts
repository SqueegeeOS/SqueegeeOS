import { describe, expect, it } from "vitest";
import {
  resolveOnboardingSafe,
  tiersDisagree,
  worstStatus,
} from "@/lib/admin/production-health-server";
import type { ProductionHealthSection } from "@/lib/admin/production-health-types";

describe("worstStatus", () => {
  it("returns the most severe status", () => {
    expect(worstStatus(["green", "yellow", "red"])).toBe("red");
    expect(worstStatus(["green", "yellow"])).toBe("yellow");
    expect(worstStatus(["green", "green"])).toBe("green");
  });
});

describe("tiersDisagree", () => {
  it("flags presentation or agreement tier mismatches", () => {
    expect(
      tiersDisagree("biannual", "quarterly", "SqueegeeKing Bi-Annual Home Care Membership"),
    ).toBe(true);
    expect(
      tiersDisagree(
        "biannual",
        "biannual",
        "SqueegeeKing Bi-Annual Home Care Membership",
      ),
    ).toBe(false);
  });
});

describe("resolveOnboardingSafe", () => {
  const greenSection = (id: string, title: string): ProductionHealthSection => ({
    id,
    title,
    status: "green",
    checks: [],
  });

  it("blocks onboarding when schema is red", () => {
    const result = resolveOnboardingSafe([
      { id: "schema", title: "Database", status: "red", checks: [] },
      greenSection("stripe", "Stripe"),
    ]);
    expect(result.status).toBe("red");
    expect(result.summary).toContain("Do not onboard");
  });

  it("requires manual review for yellow-only issues", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      { id: "stripe", title: "Stripe", status: "yellow", checks: [] },
    ]);
    expect(result.status).toBe("yellow");
    expect(result.summary).toContain("Manual review");
  });

  it("is green when all sections are green", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      greenSection("stripe", "Stripe"),
    ]);
    expect(result.status).toBe("green");
  });
});
