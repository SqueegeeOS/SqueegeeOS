import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./077_lead_intake_sales_assignment.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("lead intake sales assignment migration", () => {
  it("keeps one restrictive, indexed owner per inquiry", () => {
    expect(migration).toContain("add column if not exists lead_intake_id uuid");
    expect(migration).toContain("sales_rep_leads_lead_intake_id_fkey");
    expect(migration).toContain("references public.lead_intakes(id) on delete restrict");
    expect(migration).toContain("sales_rep_leads_lead_intake_uidx");
    expect(migration).toContain("where lead_intake_id is not null");
  });

  it("requires intake assignments to retain source and a next action", () => {
    expect(migration).toContain("sales_rep_leads_intake_assignment_check");
    expect(migration).toContain("source in ('request_form', 'facebook_lead_ad')");
    expect(migration).toContain("next_follow_up_at is not null");
  });

  it("preserves the service-role-only privacy boundary", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });

  it("includes assigned inquiry presentations in rep launch evidence", () => {
    expect(migration).toContain(
      "create or replace function public.homeatlas_sales_rep_launch_evidence()",
    );
    expect(migration).toContain(
      "assigned_lead.lead_intake_id = presentation.lead_intake_id",
    );
    expect(migration).toContain(
      "revoke all on function public.homeatlas_sales_rep_launch_evidence() from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.homeatlas_sales_rep_launch_evidence() to service_role",
    );
  });
});
