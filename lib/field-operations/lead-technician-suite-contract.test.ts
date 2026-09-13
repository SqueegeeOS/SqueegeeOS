import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const route = read("../../app/tech/suite/page.tsx");
const suite = read("../../components/field/lead-technician-suite.tsx");
const dock = read("../../components/field/technician-portal-dock.tsx");
const claim = read("../../app/api/field/access/claim/route.ts");
const access = read("../../app/tech/access/page.tsx");

describe("lead technician suite", () => {
  it("derives the profile from the authenticated native technician identity", () => {
    expect(route).toContain('requireFieldPageActor("/tech/suite")');
    expect(route).toContain("homeAtlasTechnicianId(actor.jobberUserId)");
    expect(route).toContain("profile.technician.displayName !== actor.displayName");
    expect(route).not.toContain("searchParams");
  });

  it("makes the suite the default landing area after phone activation", () => {
    expect(claim).toContain(': "/tech/suite"');
    expect(access).toContain(': "/tech/suite"');
    expect(dock).toContain('{ href: "/tech/suite", label: "Suite"');
    expect(dock).toContain("grid-cols-3");
  });

  it("shows useful field intelligence without owner billing controls", () => {
    for (const copy of [
      "Lead Tech Suite",
      "Your field pulse",
      "Clean handoff score",
      "Your production",
      "Production load",
      "Field mastery",
    ]) {
      expect(suite).toContain(copy);
    }
    expect(suite).toContain('href="/tech"');
    expect(suite).toContain('href="/tech/refer"');
    expect(suite).not.toContain("billing");
    expect(suite).not.toContain("customer messaging");
    expect(suite).not.toContain("grantId");
  });
});
