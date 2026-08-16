import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./069_sales_rep_door_memory.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

const privilegeHardeningMigration = readFileSync(
  new URL("./070_sales_rep_door_memory_privileges.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

const foreignKeyIndexMigration = readFileSync(
  new URL("./071_sales_rep_door_memory_foreign_key_indexes.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("migration 069 private sales door memory", () => {
  it("ties every memory to an owned door knock and optional owned lead", () => {
    expect(migration).toContain(
      "create table if not exists public.sales_rep_door_visits",
    );
    expect(migration).toContain(
      "foreign key (door_activity_id, rep_id) references public.sales_rep_activity_events(id, rep_id)",
    );
    expect(migration).toContain(
      "foreign key (lead_id, rep_id) references public.sales_rep_leads(id, rep_id)",
    );
    expect(migration).toContain("activity_record.event_type <> 'door_knock'");
    expect(migration).toContain("activity_record.reversed_at is not null");
    expect(migration).toContain(
      "new.occurred_at := activity_record.occurred_at",
    );
  });

  it("makes device retries and one-outcome-per-door idempotent", () => {
    expect(migration).toContain("sales_rep_door_visits_activity_uidx");
    expect(migration).toContain("sales_rep_door_visits_rep_client_event_uidx");
    expect(migration).toContain("on public.sales_rep_door_visits(rep_id, client_event_id)");
    expect(migration).toContain(
      "A door activity with saved address memory cannot be reversed.",
    );
  });

  it("indexes rep history, repeat addresses, and optional lead lineage", () => {
    expect(migration).toContain("sales_rep_door_visits_rep_occurred_idx");
    expect(migration).toContain("sales_rep_door_visits_rep_address_idx");
    expect(migration).toContain("sales_rep_door_visits_lead_idx");
    expect(migration).toContain(
      "on public.sales_rep_door_visits(door_activity_id, rep_id)",
    );
    expect(migration).toContain(
      "on public.sales_rep_door_visits(lead_id, rep_id, occurred_at desc)",
    );
    expect(foreignKeyIndexMigration).toContain(
      "create unique index sales_rep_door_visits_activity_uidx on public.sales_rep_door_visits(door_activity_id, rep_id)",
    );
    expect(foreignKeyIndexMigration).toContain(
      "create index sales_rep_door_visits_lead_idx on public.sales_rep_door_visits(lead_id, rep_id, occurred_at desc)",
    );
  });

  it("keeps address history private and exposes only least privilege", () => {
    expect(migration).toContain(
      "alter table public.sales_rep_door_visits enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.sales_rep_door_visits from public, anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "grant select, insert on table public.sales_rep_door_visits to service_role",
    );
    expect(migration).toContain(
      "grant update (lead_id) on table public.sales_rep_door_visits to service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+[^;]+on\s+(?:table\s+)?public\.sales_rep_door_visits\s+to\s+(?:anon|authenticated)/i,
    );
    expect(migration).toContain("('sales_rep_door_visits')");
    expect(privilegeHardeningMigration).toContain(
      "revoke all privileges on table public.sales_rep_door_visits from service_role",
    );
    expect(privilegeHardeningMigration).toContain(
      "grant select, insert on table public.sales_rep_door_visits to service_role",
    );
    expect(privilegeHardeningMigration).toContain(
      "grant update (lead_id) on table public.sales_rep_door_visits to service_role",
    );
    expect(privilegeHardeningMigration).not.toMatch(
      /grant\s+(?:delete|truncate|trigger|references|update(?!\s*\(lead_id\)))[^;]*on\s+(?:table\s+)?public\.sales_rep_door_visits/i,
    );
  });
});
