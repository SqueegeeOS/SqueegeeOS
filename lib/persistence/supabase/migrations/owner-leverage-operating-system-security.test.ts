import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./061_owner_leverage_operating_system.sql").replace(
  /\s+/g,
  " ",
);
const leverageServer = read("../../../admin/owner-leverage-server.ts");
const reviewServer = read(
  "../../../field-operations/independence-review-server.ts",
);
const metrics = read("../../../admin/owner-leverage.ts");
const route = read("../../../../app/api/admin/owner-leverage/route.ts");
const migrationAudit = read("../../../../scripts/audit-migrations.mjs");

describe("owner leverage operating-system security", () => {
  it("applies both private ledgers atomically", () => {
    expect(migration).toContain("begin;");
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "create table if not exists public.growth_work_sessions",
    );
    expect(migration).toContain(
      "create table if not exists public.field_independence_reviews",
    );
    expect(migration).toContain(
      "growth_work_sessions_one_open_per_rep_uidx",
    );
    expect(migration).toContain("appointment_id uuid not null unique");
  });

  it("starts Noah and Dasan cleanly without rewriting historical closes", () => {
    expect(migration).toContain("'noah'");
    expect(migration).toContain("'dasan'");
    expect(migration).toContain("'growth_operator', true");
    expect(migration).toContain("'compensation_tracking', false");
    expect(migration).not.toMatch(/update public\.presentations/i);
    expect(migration).not.toMatch(/update public\.sales_rep_attributions/i);
  });

  it("fails closed around time, quality, and owner involvement", () => {
    expect(migration).toContain(
      "status = 'completed' and ended_at is not null and ended_at >= started_at and ended_at <= started_at + interval '16 hours'",
    );
    expect(migration).toContain(
      "status = 'cancelled' and ended_at is not null and ended_at >= started_at and break_minutes = 0",
    );
    expect(leverageServer).toContain("if (!input.cancel && elapsedMinutes > 960)");
    expect(migration).toContain(
      "owner_involvement in ('none', 'remote_guidance', 'onsite_assist', 'owner_led')",
    );
    expect(migration).toContain(
      "quality_outcome in ('verified', 'follow_up', 'rework', 'safety_stop')",
    );
    expect(migration).toContain(
      "(owner_involvement = 'none' and owner_minutes = 0)",
    );
    expect(metrics).toContain("fieldReviewCountsAsBoughtBackTime");
    expect(metrics).toContain("hasOpenException");
  });

  it("keeps both ledgers service-role only", () => {
    for (const table of [
      "growth_work_sessions",
      "field_independence_reviews",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
      expect(migration).toContain(`('${table}')`);
    }
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.growth_work_sessions",
    );
    expect(migration).toContain(
      "grant select, insert, update on table public.field_independence_reviews",
    );
  });

  it("adds both ledgers to the read-only production migration audit", () => {
    expect(migrationAudit).toContain(
      '["061", "owner leverage operating system"',
    );
    expect(migrationAudit).toContain('hasTable(s, "growth_work_sessions")');
    expect(migrationAudit).toContain(
      'hasTable(s, "field_independence_reviews")',
    );
  });

  it("uses signed attribution and verified Jobber evidence instead of manual claims", () => {
    expect(leverageServer).toContain('.from("sales_rep_attributions")');
    expect(leverageServer).toContain(
      '.eq("attribution_source", "agreement_signature")',
    );
    expect(leverageServer).toContain('.eq("connection_id", JOBBER_CONNECTION_ID)');
    expect(reviewServer).toContain('appointment.verification_state !== "verified"');
    expect(reviewServer).toContain("projection.is_complete");
    expect(reviewServer).toContain("assignment.assignedUsers.find");
    expect(reviewServer).toContain("field_record_id");
  });

  it("does not send, charge, invoice, or mutate Jobber as a measurement side effect", () => {
    for (const source of [route, leverageServer, reviewServer]) {
      expect(source).not.toMatch(
        /sendOutboundCommunication|sendSms|sendEmail|twilio|resend|stripe|paymentIntent|createInvoice/i,
      );
    }
    expect(reviewServer).not.toMatch(
      /from\("jobber_visit_projections"\)[\s\S]{0,240}\.(?:insert|update|upsert|delete)\(/,
    );
    expect(leverageServer).not.toMatch(
      /from\("jobber_visit_projections"\)[\s\S]{0,240}\.(?:insert|update|upsert|delete)\(/,
    );
  });
});
