import { describe, expect, it } from "vitest";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import {
  buildMemberHomeDashboardView,
  formatLastVisitRelative,
  formatNextVisitScheduled,
  healthScoresToPanel,
} from "./member-home-dashboard-data";
import { resolveMemberPortalStatus } from "./member-portal-status";
import { resolveMemberMembershipView } from "./resolve-member-membership";

describe("member home dashboard", () => {
  it("formats visit labels for the member home summary", () => {
    const ref = new Date("2026-07-04T12:00:00Z");
    const last = new Date("2026-04-01T12:00:00Z");
    expect(formatLastVisitRelative(last, ref)).toBe("94 days ago");
    expect(formatNextVisitScheduled("September 15, 2026", ref)).toBe(
      "Scheduled September 15",
    );
  });

  it("maps recorded health checks to dashboard bars", () => {
    const scores = healthScoresToPanel({
      visitDate: "2026-07-04",
      overallScore: 84,
      windowHealth: 4,
      screenHealth: 5,
      hardWaterRisk: 3,
      customerNote: null,
    });
    expect(scores).toHaveLength(3);
    expect(scores[0]?.label).toBe("Windows");
    expect(scores[0]?.percent).toBe(80);
    expect(scores[1]?.percent).toBe(100);
    expect(scores[2]?.percent).toBe(60);
  });

  it("builds dashboard view from portal status and membership", () => {
    const status = resolveMemberPortalStatus(canyonOaksHomeCarePlan);
    const membership = resolveMemberMembershipView(canyonOaksHomeCarePlan);
    const view = buildMemberHomeDashboardView(
      canyonOaksHomeCarePlan,
      status,
      membership,
      { planPath: "/homecare/larry-buckley/canyon-oaks-residence/plan" },
    );

    expect(view.memberFirstName).toBe("Larry");
    expect(view.planLabel).toBe("Quarterly Plan");
    expect(view.addOnDiscountPercent).toBe(25);
    expect(view.bookAddOnHref).toBe("#member-addons");
    expect(view.viewHistoryHref).toContain("#journey");
    expect(view.totalSaved).toBeGreaterThan(0);
    expect(view.savedThisYear).toBeGreaterThan(0);
    expect(view.propertyHealth).toHaveLength(0);
  });
});
