import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./049_sales_activity_reversal.sql").replace(/\s+/g, " ");
const server = read("../../../sales/workspace-server.ts");
const reversalPolicy = read("../../../sales/activity-reversal.ts");
const audit = read("../../../../scripts/audit-migrations.mjs").replace(
  /\s+/g,
  " ",
);

describe("sales activity reversal security", () => {
  it("records an auditable reversal instead of deleting the activity", () => {
    expect(migration).toContain("add column if not exists reversed_at timestamptz");
    expect(migration).toContain("add column if not exists reversed_by text");
    expect(migration).toContain("add column if not exists reversal_reason text");
    expect(migration).toContain("sales_rep_activity_reversal_audit_check");
    expect(migration).toMatch(
      /reversed_at is null[\s\S]*reversed_by is null[\s\S]*reversal_reason is null/,
    );
    expect(migration).toMatch(
      /reversed_at is not null[\s\S]*reversed_by is not null[\s\S]*reversal_reason is not null/,
    );
  });

  it("keeps reversal access server-only and preserves the append-only event core", () => {
    expect(migration).toContain(
      "revoke update, delete on table public.sales_rep_activity_events from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke delete on table public.sales_rep_activity_events from service_role",
    );
    expect(migration).toContain(
      "grant update (reversed_at, reversed_by, reversal_reason) on table public.sales_rep_activity_events to service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+[^;]*delete[^;]*sales_rep_activity_events[^;]*service_role/i,
    );
    expect(migration).not.toMatch(
      /grant\s+[^;]*(?:insert|update|delete)[^;]*sales_rep_activity_events[^;]*(?:anon|authenticated)/i,
    );
  });

  it("excludes reversed events from totals and scopes an undo to the rep and receipt", () => {
    expect(server).toContain('.is("reversed_at", null)');
    expect(reversalPolicy).toContain(
      "SALES_ACTIVITY_UNDO_WINDOW_MS = 10 * 60 * 1000",
    );
    expect(server).toContain('.eq("id", activityId)');
    expect(server).toContain('.eq("rep_id", rep.id)');
    expect(server).toContain('reversed_by: "hq_admin_session"');
    expect(server).toContain('reversal_reason: "operator_undo"');
    expect(server).not.toContain(
      '.from("sales_rep_activity_events")\n    .delete()',
    );
  });

  it("adds reversal columns to the read-only production migration ledger", () => {
    expect(audit).toMatch(/\["049", "[^"]*sales activity reversal"/i);
    expect(audit).toMatch(
      /hasColumns\(s, "sales_rep_activity_events", "reversed_at", "reversed_by", "reversal_reason"\)/,
    );
  });
});
