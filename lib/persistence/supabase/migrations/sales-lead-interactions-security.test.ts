import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./078_sales_lead_interactions.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("migration 078 private sales lead interactions", () => {
  it("binds immutable history to one representative-owned lead", () => {
    expect(migration).toContain(
      "create table if not exists public.sales_rep_lead_interactions",
    );
    expect(migration).toContain(
      "foreign key (lead_id, rep_id) references public.sales_rep_leads(id, rep_id)",
    );
    expect(migration).toContain(
      "on public.sales_rep_lead_interactions(rep_id, client_event_id)",
    );
    expect(migration).toContain(
      "on public.sales_rep_lead_interactions(lead_id, rep_id, occurred_at desc, id desc)",
    );
  });

  it("serializes phone retries before atomically advancing the lead", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("new.expected_lead_updated_at is distinct from lead_record.updated_at");
    expect(migration).toContain("for update");
    expect(migration).toContain("update public.sales_rep_leads lead set status = new.resulting_status");
    expect(migration).toContain("return new");
    expect(migration).toContain(
      "before insert on public.sales_rep_lead_interactions",
    );
  });

  it("allows only supported outcomes with a real next action or close reason", () => {
    expect(migration).toContain("when 'no_answer' then 'follow_up'");
    expect(migration).toContain("when 'spoke_follow_up' then 'considering'");
    expect(migration).toContain("when 'presentation_scheduled' then 'presentation'");
    expect(migration).toContain("when 'not_interested' then 'lost'");
    expect(migration).toContain("Choose a future next action within one year.");
    expect(migration).toContain("Add a short reason before closing this lead.");
  });

  it("keeps customer contact history private and append-only", () => {
    expect(migration).toContain(
      "alter table public.sales_rep_lead_interactions enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.sales_rep_lead_interactions from public, anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "grant select, insert on table public.sales_rep_lead_interactions to service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+(?:update|delete|truncate|references|trigger)[^;]*sales_rep_lead_interactions/i,
    );
    expect(migration).toContain("('sales_rep_lead_interactions')");
  });
});
