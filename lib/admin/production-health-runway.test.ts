import { describe, expect, it } from "vitest";
import { buildProductionReadinessLanes } from "@/lib/admin/production-health-runway";
import type {
  ProductionHealthCheck,
  ProductionHealthReport,
} from "@/lib/admin/production-health-types";

function reportWith(checks: ProductionHealthCheck[]): ProductionHealthReport {
  return {
    onboardingSafe: "green",
    summary: "Ready",
    checkedAt: "2026-08-14T12:00:00.000Z",
    sections: [
      {
        id: "mixed",
        title: "Mixed checks",
        status: "green",
        checks,
      },
    ],
  };
}

function check(
  id: string,
  status: ProductionHealthCheck["status"],
): ProductionHealthCheck {
  return { id, status, label: id, message: id };
}

describe("production readiness runway", () => {
  it("makes the owner service loop a first-class lane", () => {
    const serve = buildProductionReadinessLanes(
      reportWith([
        check("field-record-media-schema", "green"),
        check("field-record-follow-up-schema", "green"),
        check("field-record-service-scope-schema", "green"),
        check("storage-visit-media", "green"),
      ]),
    ).find((lane) => lane.id === "serve");

    expect(serve).toMatchObject({
      label: "Serve",
      status: "green",
      readyCheckCount: 4,
      totalCheckCount: 4,
    });
    expect(serve?.description).toContain("portal proof");
  });

  it("fails the service lane closed when private media is blocked", () => {
    const serve = buildProductionReadinessLanes(
      reportWith([
        check("field-record-media-schema", "green"),
        check("field-record-follow-up-schema", "green"),
        check("field-record-service-scope-schema", "green"),
        check("storage-visit-media", "red"),
      ]),
    ).find((lane) => lane.id === "serve");

    expect(serve?.status).toBe("red");
    expect(serve?.readyCheckCount).toBe(3);
  });

  it("requires review when a lane check is missing from the live report", () => {
    const serve = buildProductionReadinessLanes(
      reportWith([check("field-record-media-schema", "green")]),
    ).find((lane) => lane.id === "serve");

    expect(serve?.status).toBe("yellow");
    expect(serve?.readyCheckCount).toBe(1);
  });
});
