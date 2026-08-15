import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./062_technician_readiness_and_independent_day.sql");
const server = read("../../../field-operations/technician-readiness-server.ts");
const route = read(
  "../../../../app/api/admin/technicians/readiness/route.ts",
);
const migrationAudit = read("../../../../scripts/audit-migrations.mjs");
const productionHealth = read("../../../admin/production-health-server.ts");

describe("technician readiness security contract", () => {
  it("keeps competency history append-only and private", () => {
    expect(migration).toContain(
      "create table if not exists public.technician_competency_assessments",
    );
    expect(migration).toContain(
      "alter table public.technician_competency_assessments enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.technician_competency_assessments",
    );
    expect(migration).toContain(
      "grant select, insert on table public.technician_competency_assessments",
    );
    expect(migration).not.toMatch(
      /grant[\s\S]{0,40}update[\s\S]{0,80}technician_competency_assessments/i,
    );
    expect(migration).not.toMatch(
      /grant[\s\S]{0,40}delete[\s\S]{0,80}technician_competency_assessments/i,
    );
  });

  it("allows a trial to be cancelled but never manually passed", () => {
    expect(migration).toContain("status in ('planned', 'cancelled')");
    expect(migration).not.toMatch(/status[^\n]+passed/i);
    expect(migration).toContain(
      "technician_independent_day_trials_planned_date_uidx",
    );
    expect(migration).toContain(
      "grant update (\n  status,\n  cancelled_at,\n  cancelled_by,\n  cancellation_reason",
    );
    expect(server).toContain("deriveIndependentDayOutcome");
    expect(server).toContain("qualifyingIndependentStops");
    expect(server).toContain("fieldReviewCountsAsBoughtBackTime");
  });

  it("binds actions to the exact mirrored Jobber technician", () => {
    expect(server).toContain("listTechnicianAccessRoster");
    expect(server).toContain("member.jobberUserId === input.jobberUserId");
    expect(server).toContain("member.displayName === input.displayName");
    expect(server).toContain("readJobberTodayVisitAssignment");
    expect(server).toContain('assignmentReadState !== "available"');
  });

  it("keeps the API private and free of provider or money mutations", () => {
    expect(route).toContain("authorizeAdminRequest(request.headers)");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(`${route}\n${server}`).not.toMatch(
      /sendOutboundCommunication|sendSms|sendEmail|twilio|resend|stripe|paymentIntent/i,
    );
    expect(server).not.toMatch(
      /from\("jobber_visit_projections"\)[\s\S]{0,260}\.(?:insert|update|upsert|delete)\(/,
    );
  });

  it("adds both tables to privacy, migration audit, and production health", () => {
    for (const table of [
      "technician_competency_assessments",
      "technician_independent_day_trials",
    ]) {
      expect(migration).toContain(`('${table}')`);
      expect(migrationAudit).toContain(`hasTable(s, "${table}")`);
      expect(productionHealth).toContain(`table: "${table}"`);
    }
    expect(migrationAudit).toContain(
      '["062", "technician readiness and independent day"',
    );
  });
});
