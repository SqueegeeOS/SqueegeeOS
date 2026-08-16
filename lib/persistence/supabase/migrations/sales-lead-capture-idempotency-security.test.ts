import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./079_sales_lead_capture_idempotency.sql", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const audit = readFileSync(
  new URL("../../../../scripts/audit-migrations.mjs", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("sales lead capture idempotency migration", () => {
  it("stores exact retry proof with rep-scoped uniqueness", () => {
    expect(migration).toContain("add column if not exists client_event_id uuid");
    expect(migration).toContain("add column if not exists capture_fingerprint text");
    expect(migration).toContain(
      "add column if not exists door_memory_client_event_id uuid",
    );
    expect(migration).toContain("sales_rep_leads_rep_client_event_uidx");
    expect(migration).toContain("sales_rep_leads_rep_door_memory_uidx");
    expect(migration).toContain("capture_fingerprint ~ '^[0-9a-f]{64}$'");
  });

  it("derives capture evidence and Door Memory binding in the insert transaction", () => {
    expect(migration).toContain("homeatlas_record_sales_lead_capture");
    expect(migration).toContain("after insert on public.sales_rep_leads");
    expect(migration).toContain("insert into public.sales_rep_activity_events");
    expect(migration).toContain("'lead_captured'");
    expect(migration).toContain("update public.sales_rep_door_visits");
    expect(migration).toContain(
      "client_event_id = new.door_memory_client_event_id",
    );
  });

  it("keeps the trigger invoker-scoped and unavailable as an RPC", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration.toLowerCase()).not.toContain("security definer");
  });

  it("is represented in the read-only production migration ledger", () => {
    expect(audit).toContain(
      '["079", "idempotent field homeowner capture"',
    );
    expect(audit).toContain("leadCaptureTriggerReady");
  });
});
