import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/048_sales_rep_workspace.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\s+/g, " ");

describe("private sales workspace schema contract", () => {
  it("creates the reusable rep, lead, activity, and attribution boundaries", () => {
    for (const table of [
      "sales_reps",
      "sales_rep_leads",
      "sales_rep_activity_events",
      "sales_rep_attributions",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table} from public, anon, authenticated`,
      );
    }
  });

  it("hard-separates David's founding plan from standard future reps", () => {
    expect(migration).toContain(
      "(slug = 'david' and compensation_plan = 'founding_david') or (slug <> 'david' and compensation_plan = 'standard_commission')",
    );
    expect(migration).toContain("'exclusive_to', 'david'");
    expect(migration).toContain("'draft_tracking_only'");
    expect(migration).toContain(
      "not a payout or equity issuance ledger",
    );
  });

  it("requires consent evidence before a lead can be marked textable", () => {
    expect(migration).toContain("sales_rep_leads_sms_consent_evidence_check");
    expect(migration).toContain("sms_consent_recorded_at is not null");
    expect(migration).toContain("sms_consent_disclosure_version");
    expect(migration).toContain("sms_consent_source_path");
  });

  it("does not grant mutation access to browser database roles", () => {
    expect(migration).not.toMatch(/grant .* to (?:anon|authenticated)/);
    expect(migration).toContain(
      "grant select, insert on table public.sales_rep_activity_events to service_role",
    );
  });
});
