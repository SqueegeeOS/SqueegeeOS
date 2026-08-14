import { describe, expect, it } from "vitest";
import { buildProductionHealthActions } from "@/lib/admin/production-health-actions";
import type { ProductionHealthReport } from "@/lib/admin/production-health-types";

function report(): ProductionHealthReport {
  return {
    onboardingSafe: "green",
    summary: "Ready",
    checkedAt: "2026-08-14T12:00:00.000Z",
    sections: [
      {
        id: "integrations",
        title: "Integrations & automation",
        status: "red",
        checks: [
          {
            id: "jobber-connection",
            label: "Jobber account connection",
            status: "yellow",
            message: "Reconnect Jobber.",
          },
          {
            id: "billing-exceptions",
            label: "Billing exception queue",
            status: "red",
            message: "One order needs attention.",
          },
          {
            id: "atlas-ai",
            label: "Atlas plan assistant",
            status: "green",
            message: "Ready.",
          },
        ],
      },
    ],
  };
}

describe("buildProductionHealthActions", () => {
  it("puts blockers first, excludes green checks, and routes to the right tools", () => {
    const actions = buildProductionHealthActions(report());

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      label: "Billing exception queue",
      href: "/hq/billing",
      status: "red",
    });
    expect(actions[1]).toMatchObject({
      label: "Jobber account connection",
      href: "/hq/jobber",
      status: "yellow",
    });
  });

  it("honors the requested action limit", () => {
    expect(buildProductionHealthActions(report(), 1)).toHaveLength(1);
    expect(buildProductionHealthActions(report(), 0)).toEqual([]);
  });
});
