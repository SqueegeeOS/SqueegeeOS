import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const proxy = read("../../proxy.ts");
const fieldRun = read(
  "../../components/field/technician-today-workspace.tsx",
);
const technicianHome = read("../../app/tech/page.tsx");
const propertyDirectory = read("../../app/tech/properties/page.tsx");
const todayRoute = read(
  "../../app/api/admin/care-operations/jobber/today/route.ts",
);
const fieldCapture = read("../../components/visit/visit-field-capture.tsx");

describe("technician field run contract", () => {
  it("keeps every technician surface behind the signed owner session", () => {
    expect(proxy).toContain('"/tech/:path*"');
    expect(todayRoute).toContain("authorizeAdminRequest(request.headers)");
  });

  it("uses Jobber read truth and HomeAtlas field proof without mutating Jobber", () => {
    expect(fieldRun).toContain(
      'fetch("/api/admin/care-operations/jobber/today"',
    );
    expect(fieldRun).toContain("resolveTechnicianVisitReadiness");
    expect(fieldRun).toContain("selectTechnicianNextAction");
    expect(fieldRun).toContain("VisitFieldCapture");
    expect(fieldRun).not.toContain(
      'fetch("/api/admin/care-operations/jobber/sync"',
    );
  });

  it("makes the live field run primary while preserving the full property memory", () => {
    expect(technicianHome).toContain("TechnicianTodayWorkspace");
    expect(propertyDirectory).toContain("listTechnicianProperties");
    expect(fieldRun).toContain('href="/tech/properties"');
    expect(fieldRun).toContain(
      "href={`/tech/properties/${propertyId}`}",
    );
  });

  it("keeps closeout and portal truth explicit for the person in the field", () => {
    expect(fieldRun).toContain('label: "Closeout required"');
    expect(fieldRun).toContain('label: "Portal update needed"');
    expect(fieldRun).toContain('label: "Closed out"');
    expect(fieldRun).toContain("Saved on this device");
  });

  it("mirrors Jobber crew coverage without inventing a second schedule", () => {
    expect(fieldRun).toContain("listTechnicianCrew");
    expect(fieldRun).toContain("filterTechnicianVisits");
    expect(fieldRun).toContain("Route lens");
    expect(fieldRun).toContain("Saved on this phone");
    expect(fieldRun).toContain("Unassigned in Jobber");
    expect(fieldRun).toContain("Users read access");
  });

  it("turns Jobber line items into a durable exception-aware worklist", () => {
    expect(fieldRun).toContain("Service scope");
    expect(fieldRun).toContain("scopeItems={visit.scopeItems}");
    expect(fieldCapture).toContain("Jobber worklist");
    expect(fieldCapture).toContain(
      "Mark every Jobber service item done, or explain what remains.",
    );
    expect(fieldCapture).toContain("automatedScopeFollowUp");
    expect(fieldCapture).toContain("Build customer update from completed work");
  });
});
