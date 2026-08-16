import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./075_derive_door_conversation_activity.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("migration 075 derived doorstep conversations", () => {
  it("derives one talk from the three conversational door outcomes", () => {
    expect(migration).toContain(
      "if new.disposition not in ('conversation', 'follow_up', 'interested') then",
    );
    expect(migration).toContain(
      "after insert on public.sales_rep_door_visits",
    );
    expect(migration).toContain("'conversation', 1, '/sales/door-memory'");
    expect(migration).toContain("new.client_event_id");
    expect(migration).toContain("new.occurred_at");
  });

  it("stores only audit-safe lineage and never copies doorstep PII", () => {
    expect(migration).toContain("'derived_from', 'door_memory'");
    expect(migration).toContain("'door_visit_id', new.id");
    expect(migration).not.toContain("new.property_address");
    expect(migration).not.toContain("new.address_key");
    expect(migration).not.toContain("new.notes");
  });

  it("runs with caller privileges and cannot be invoked as an RPC", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain(
      "revoke all on function public.homeatlas_record_door_conversation_activity() from public, anon, authenticated, service_role",
    );
    expect(migration).not.toContain("security definer");
    expect(migration).not.toMatch(
      /grant\s+execute\s+on\s+function\s+public\.homeatlas_record_door_conversation_activity/i,
    );
  });
});
