import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260901041051_owner_dispatch_assignment_audit.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("owner dispatch assignment audit migration", () => {
  it("is transactional, private, and service-role write-limited", () => {
    expect(migration.trimStart()).toContain("begin;");
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "alter table public.owner_dispatch_assignment_events enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.owner_dispatch_assignment_events from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert on table public.owner_dispatch_assignment_events to service_role",
    );
    expect(migration).not.toMatch(/grant\s+(update|delete)/);
  });

  it("makes assignment evidence immutable and idempotent", () => {
    expect(migration).toContain("client_request_id uuid not null unique");
    expect(migration).toContain(
      "before update or delete on public.owner_dispatch_assignment_events",
    );
    expect(migration).toContain("append-only and immutable");
  });
});
