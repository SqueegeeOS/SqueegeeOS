import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./063_technician_capacity_planning.sql");
const server = read("../../../field-operations/technician-capacity-server.ts");
const route = read(
  "../../../../app/api/admin/technicians/capacity/route.ts",
);
const migrationAudit = read("../../../../scripts/audit-migrations.mjs");
const productionHealth = read("../../../admin/production-health-server.ts");

describe("technician capacity security contract", () => {
  it("keeps capacity assumptions append-only and private", () => {
    expect(migration).toContain(
      "create table if not exists public.technician_capacity_plans",
    );
    expect(migration).toContain(
      "alter table public.technician_capacity_plans enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.technician_capacity_plans",
    );
    expect(migration).toContain(
      "grant select, insert on table public.technician_capacity_plans",
    );
    expect(migration).not.toMatch(
      /grant[\s\S]{0,40}update[\s\S]{0,80}technician_capacity_plans/i,
    );
    expect(migration).not.toMatch(
      /grant[\s\S]{0,40}delete[\s\S]{0,80}technician_capacity_plans/i,
    );
  });

  it("labels labor cost as a planning input rather than financial truth", () => {
    expect(migration).toContain("Not payroll, booked revenue, or gross profit");
    expect(migration).toContain("not a payroll record");
    expect(migration).toContain("weekly_capacity_minutes between 0 and 4800");
    expect(migration).toContain("extract(isodow from effective_week_start) = 1");
  });

  it("keeps schedule projection reads fail-closed and mutation-free", () => {
    const start = server.indexOf(
      "export async function loadTechnicianCapacitySnapshot",
    );
    const end = server.indexOf(
      "async function resolveMirroredTechnician",
      start,
    );
    const loader = server.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(loader).toContain('from("jobber_visit_projections")');
    expect(loader).toContain("PROJECTION_QUERY_LIMIT");
    expect(loader).toContain("unknown rather than undercounted");
    expect(loader).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
  });

  it("binds plans to the exact mirrored Jobber identity", () => {
    expect(server).toContain("listTechnicianAccessRoster");
    expect(server).toContain("member.jobberUserId === input.jobberUserId");
    expect(server).toContain("member.displayName === input.displayName");
    expect(server).toContain("client_request_id");
  });

  it("keeps the API private and free of provider or money mutations", () => {
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(`${route}\n${server}`).not.toMatch(
      /sendOutboundCommunication|sendSms|sendEmail|twilio|resend|stripe|paymentIntent/i,
    );
  });

  it("adds the plan table to privacy, migration audit, and production health", () => {
    expect(migration).toContain("('technician_capacity_plans')");
    expect(migrationAudit).toContain(
      '["063", "technician capacity planning"',
    );
    expect(migrationAudit).toContain(
      'hasTable(s, "technician_capacity_plans")',
    );
    expect(productionHealth).toContain('table: "technician_capacity_plans"');
  });
});
