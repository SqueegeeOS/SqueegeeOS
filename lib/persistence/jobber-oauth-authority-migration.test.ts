import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/044_jobber_oauth_authority_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./supabase/tests/044_jobber_oauth_authority_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 044 Jobber OAuth authority hardening", () => {
  it("is a transactional forward migration with no caller-attested digest", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trimEnd().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration).toContain("add column if not exists oauth_operation_id uuid");
    expect(migration).toContain(
      "create unique index if not exists jobber_connection_events_oauth_operation_uidx",
    );
    expect(migration).not.toContain("requested_payload_sha256");
    expect(migration).not.toMatch(/update\s+public\.jobber_connection_events/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.jobber_connection_events/i);
  });

  it("computes the canonical digest from every replay-significant field", () => {
    for (const field of [
      "requested_operation_id::text",
      "requested_expected_account_id",
      "requested_account_id",
      "requested_account_name",
      "requested_access_token_ciphertext",
      "requested_refresh_token_ciphertext",
      "requested_access_token_expires_at at time zone 'UTC'",
      "requested_graphql_version",
      "requested_actor_id::text",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("extensions.digest(");
    expect(migration).toContain("'sha256'");
    expect(migration).toContain(
      "pg_catalog.jsonb_build_object('payload_sha256', computed_payload_sha256)",
    );
  });

  it("checks serialized immutable evidence before current actor authority", () => {
    const operationLock = migration.indexOf("jobber-oauth-operation:");
    const replayLookup = migration.indexOf(
      "where event.oauth_operation_id = requested_operation_id",
    );
    const replayReturn = migration.indexOf("return 'replay'");
    const actorLock = migration.indexOf("from public.hq_admin_users actor");
    const singletonLock = migration.indexOf("jobber-connection:squeegeeking");
    const connectionMutation = migration.indexOf("update public.jobber_connections");

    expect(operationLock).toBeGreaterThan(0);
    expect(replayLookup).toBeGreaterThan(operationLock);
    expect(replayReturn).toBeGreaterThan(replayLookup);
    expect(actorLock).toBeGreaterThan(replayReturn);
    expect(singletonLock).toBeGreaterThan(actorLock);
    expect(connectionMutation).toBeGreaterThan(singletonLock);
    expect(migration).toContain("actor.active is true");
    expect(migration).toContain("actor.role in ('owner', 'operator')");
    expect(migration).toContain("for share;");
  });

  it("removes legacy overloads and closes function, table, RLS, and trigger authority", () => {
    expect(migration).toContain(
      "text, text, text, text, timestamptz, text, uuid",
    );
    expect(migration).toContain(
      "uuid, text, text, text, text, text, text, timestamptz, text, uuid",
    );
    expect(migration).toContain(
      "uuid, text, text, text, text, text, timestamptz, text, uuid",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration).toContain("to service_role;");
    expect(migration).toContain(
      "alter table public.jobber_connection_events enable row level security",
    );
    expect(migration).toContain("trigger_info.tgtype::integer = 27");
    expect(migration).toContain("trigger_info.tgenabled = 'O'");
  });

  it("rehearses exact replay, reauthorization, and each changed field", () => {
    for (const label of [
      "wrong account",
      "changed expected account ID",
      "changed account ID",
      "changed account name",
      "changed access ciphertext",
      "changed refresh ciphertext",
      "changed normalized expiry",
      "changed GraphQL version",
      "changed actor ID",
    ]) {
      expect(rehearsal).toContain(`'${label}'`);
    }
    expect(rehearsal).toContain("Inactive-actor exact replay");
    expect(rehearsal).toContain("Deleted-actor exact replay");
    expect(rehearsal).toContain("Reauthorization returned");
    expect(rehearsal.trimEnd().toLowerCase().endsWith("rollback;")).toBe(true);
  });
});
