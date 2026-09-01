import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./086_private_jobber_territory_map.sql").replace(
  /\s+/g,
  " ",
);
const route = read(
  "../../../../app/api/sales/[repSlug]/territory/route.ts",
);
const territoryServer = read("../../../sales/territory-server.ts");
const reconcileCron = read(
  "../../../../app/api/cron/jobber-reconcile/route.ts",
);

describe("private Jobber territory proof map", () => {
  it("applies its schema and privacy boundary atomically", () => {
    expect(migration).toContain("begin;");
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "alter table public.jobber_territory_geocodes enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.jobber_territory_geocodes from public, anon, authenticated",
    );
    expect(migration).toContain("('jobber_territory_geocodes')");
    expect(migration).toContain("homeatlas_security_posture");
  });

  it("requires private operator authorization for reads and refreshes", () => {
    expect(route.match(/authorizeAdminRequest\(request\.headers\)/g)).toHaveLength(
      2,
    );
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });

  it("uses completed Jobber visits as the only proof source", () => {
    expect(territoryServer).toContain('.from("jobber_visit_projections")');
    expect(territoryServer).toContain('.eq("is_complete", true)');
    expect(territoryServer).toContain('.neq("visit_status", "REMOVED")');
    expect(territoryServer).toContain('source: "jobber_completed_visits"');
  });

  it("finishes a time-bounded map backlog after the nightly Jobber snapshot", () => {
    expect(reconcileCron).toContain('geocodeTerritoryBacklog("david"');
    expect(reconcileCron).toContain("stopAtMs: requestStartedAt + 180_000");
    expect(reconcileCron).toContain("the Jobber snapshot still completed");
  });
});
