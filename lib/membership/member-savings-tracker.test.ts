import { describe, expect, it } from "vitest";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { buildMemberSavingsSummary } from "./member-savings-tracker";
import { resolveMemberMembershipView } from "./resolve-member-membership";

describe("member savings tracker", () => {
  it("estimates plan savings when no live portal data exists", () => {
    const membership = resolveMemberMembershipView(canyonOaksHomeCarePlan, {
      referenceDate: new Date("2026-07-04T12:00:00Z"),
    });
    const summary = buildMemberSavingsSummary(
      membership,
      null,
      new Date("2026-07-04T12:00:00Z"),
    );

    expect(summary.source).toBe("plan");
    expect(summary.totalSaved).toBeGreaterThan(0);
    expect(summary.savedThisYear).toBeGreaterThan(0);
    expect(summary.lines.length).toBeGreaterThan(0);
  });

  it("prefers tracked lifetime savings from portal transactions", () => {
    const membership = resolveMemberMembershipView(canyonOaksHomeCarePlan);
    const portalData = {
      profile: {
        totalSaved: 420,
        firstName: "Larry",
      },
      lifetimeSavings: {
        savings: 380,
        retail: 1200,
        paid: 820,
        entries: [
          {
            date: "2026-03-01T00:00:00Z",
            serviceType: "Exterior wash",
            saved: 380,
            regularPrice: 600,
            memberPrice: 220,
          },
        ],
      },
      ytdSavings: { savings: 380, retail: 600, paid: 220 },
    } as unknown as MemberPortalData;

    const summary = buildMemberSavingsSummary(membership, portalData);

    expect(summary.source).toBe("live");
    expect(summary.totalSaved).toBe(420);
    expect(summary.savedThisYear).toBe(380);
    expect(summary.lines.some((line) => line.label === "Exterior wash")).toBe(
      true,
    );
  });
});
