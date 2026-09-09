import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("post-independence Headquarters defaults", () => {
  it("makes independent production the default Team surface", () => {
    const hub = read("components/admin/technician-hub-page.tsx");
    const production = read("components/admin/independent-production-hub.tsx");

    expect(hub).toContain("IndependentProductionHub");
    expect(hub).not.toContain("TechnicianAccessPage");
    expect(production).toContain("Independent production · live");
    expect(production).toContain("Full-time technician");
    expect(production).toContain("Tyler Germany");
    expect(production).toContain("/hq/technicians/access");
  });

  it("moves readiness-era controls behind the access archive", () => {
    const archive = read("app/hq/technicians/access/page.tsx");
    const attention = read("lib/admin/owner-attention-server.ts");

    expect(archive).toContain("TechnicianAccessPage");
    expect(attention).toContain("TYLER_GERMANY_TECHNICIAN_ID");
    expect(attention).toContain("technicians: snapshot.technicians.filter");
    expect(attention).toContain("trials: snapshot.trials.filter");
  });

  it("makes sales-to-production compounding the default Growth surface", () => {
    const route = read("app/hq/growth/page.tsx");
    const operating = read("components/admin/growth-operating-loop-page.tsx");
    const archive = read("app/hq/growth/planning/page.tsx");

    expect(route).toContain("GrowthOperatingLoopPage");
    expect(route).not.toContain("GrowthCommandCenterPage");
    expect(operating).toContain("Sell while Tyler produces. Then do it again.");
    expect(operating).toContain("Keep Tyler full");
    expect(operating).toContain("Add capacity before pain");
    expect(archive).toContain("GrowthCommandCenterPage");
  });
});
