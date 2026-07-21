import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const careOperationRoutes = [
  "../../app/api/admin/care-operations/billing-preview/route.ts",
  "../../app/api/admin/care-operations/jobber/oauth/start/route.ts",
  "../../app/api/admin/care-operations/jobber/oauth/callback/route.ts",
  "../../app/api/admin/care-operations/jobber/oauth/status/route.ts",
  "../../app/api/admin/care-operations/jobber/property-links/route.ts",
  "../../app/api/admin/care-operations/jobber/visits/sample/route.ts",
];

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("PR1a authorization scope", () => {
  it("protects every Care Operations and Jobber route without the shared PIN", () => {
    for (const route of careOperationRoutes) {
      const source = read(route);
      expect(source, route).toContain("authorizeHqApiRequest()");
      expect(source, route).not.toMatch(
        /authorizeAdminRequest|x-admin-pin|NEXT_PUBLIC_ADMIN_PIN/,
      );
    }
  });

  it("propagates authenticated actor UUIDs into existing decision/event fields", () => {
    const callback = read(
      "../../app/api/admin/care-operations/jobber/oauth/callback/route.ts",
    );
    const links = read(
      "../../app/api/admin/care-operations/jobber/property-links/route.ts",
    );
    const connectionStore = read("../care-operations/jobber-connection-store.ts");
    const propertyMatching = read(
      "../care-operations/jobber-property-matching.ts",
    );

    expect(callback).toContain("actorId: authorization.actor.id");
    expect(links.match(/actorId: authorization\.actor\.id/g)).toHaveLength(2);
    expect(connectionStore).toContain("requested_actor_id: input.actorId");
    expect(propertyMatching).toContain("linked_by: input.actorId");
    expect(propertyMatching).toContain("revoked_by: input.actorId");
    expect(propertyMatching).not.toContain('const LINK_ACTOR = "hq_admin"');
  });

  it("keeps automatic signup disabled without source-level approval disclosure", () => {
    const requestRoute = read("../../app/auth/hq/request/route.ts");
    expect(requestRoute).toContain("shouldCreateUser: false");
    expect(requestRoute).not.toMatch(/not approved|unknown email|user not found/i);
  });
});

describe("migration 035", () => {
  const migration = read(
    "../persistence/supabase/migrations/035_hq_authenticated_access.sql",
  );

  it("is additive, seedless, normalized, RLS-protected, and server-only", () => {
    expect(migration).toContain("references auth.users(id) on delete restrict");
    expect(migration).toContain("role in ('owner', 'operator')");
    expect(migration).toContain("email = lower(btrim(email))");
    expect(migration).toContain("validate_hq_admin_user_auth_email");
    expect(migration).toContain("new.email <> auth_email");
    expect(migration).toContain("authorization user_id is immutable");
    expect(migration).toContain("sync_hq_admin_user_auth_email");
    expect(migration).toContain("after update of email on auth.users");
    expect(migration).not.toMatch(/insert\s+into\s+public\.hq_admin_users/i);
    for (const table of [
      "hq_admin_users",
      "hq_admin_user_events",
      "hq_magic_link_request_events",
      "hq_magic_link_delivery_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("uses atomic, append-only limiter evidence", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("one marker per matching email/network window");
    expect(migration).toContain("security definer");
    expect(migration).toContain("append-only and immutable");
    expect(migration).toContain("on delete restrict");
    expect(migration).not.toContain("migration_030");
  });

  it("pins every new SECURITY DEFINER function to pg_catalog", () => {
    const functionNames = [
      "validate_hq_admin_user_auth_email",
      "sync_hq_admin_user_auth_email",
      "record_hq_admin_user_change",
      "reserve_hq_magic_link_request",
      "save_jobber_connection_with_event",
      "acquire_jobber_refresh_lease_for_generation",
      "complete_jobber_refresh_with_event",
      "fail_jobber_refresh_with_event",
    ];
    for (const name of functionNames) {
      const start = migration.indexOf(`create or replace function public.${name}`);
      const end = migration.indexOf("$$;", start);
      expect(start, name).toBeGreaterThanOrEqual(0);
      expect(migration.slice(start, end), name).toContain(
        "set search_path = pg_catalog",
      );
    }
    const reserveStart = migration.indexOf(
      "create or replace function public.reserve_hq_magic_link_request",
    );
    const reserveEnd = migration.indexOf("$$;", reserveStart);
    const reserve = migration.slice(reserveStart, reserveEnd);
    expect(reserve).toContain("from public.hq_magic_link_request_events");
    expect(reserve).toContain("insert into public.hq_magic_link_request_events");
    expect(reserve).not.toContain("set search_path = public");
  });

  it("records immutable HQ authorization changes and atomically persists Jobber connection events", () => {
    expect(migration).toContain("create table if not exists public.hq_admin_user_events");
    expect(migration).toContain("hq_admin_users_record_change");
    expect(migration).toContain("hq_admin_user_events_immutable");
    expect(migration).toContain("previous_active");
    expect(migration).toContain("new_active");

    const start = migration.indexOf(
      "create or replace function public.save_jobber_connection_with_event",
    );
    const end = migration.indexOf("$$;", start);
    const atomicJobberWrite = migration.slice(start, end);
    expect(atomicJobberWrite).toContain("update public.jobber_connections");
    expect(atomicJobberWrite).toContain("insert into public.jobber_connections");
    expect(atomicJobberWrite).toContain(
      "insert into public.jobber_connection_events",
    );
    expect(atomicJobberWrite.indexOf("public.jobber_connection_events")).toBeGreaterThan(
      atomicJobberWrite.indexOf("public.jobber_connections"),
    );
  });

  it("records unknown provider delivery outcomes without claiming rejection", () => {
    expect(migration).toContain(
      "'provider_accepted', 'provider_rejected', 'provider_unknown'",
    );
  });

  it("ships a rollback-only failure-injection rehearsal for atomic Jobber persistence", () => {
    const rehearsal = read(
      "../persistence/supabase/tests/035_atomic_jobber_connection_failure.sql",
    );

    expect(rehearsal).toContain("injected Jobber event failure");
    expect(rehearsal).toContain(
      "Connection state survived an event-write failure",
    );
    expect(rehearsal).toMatch(/begin;[\s\S]*rollback;/i);
  });

  it("ships refresh transition rollback and stale-lease rehearsals", () => {
    const rehearsal = read(
      "../persistence/supabase/tests/035_atomic_jobber_refresh_transitions.sql",
    );
    expect(rehearsal).toContain("Successful refresh state survived event rollback");
    expect(rehearsal).toContain("Failed-refresh state survived event rollback");
    expect(rehearsal).toContain("A stale refresh lease unexpectedly succeeded");
    expect(rehearsal).toMatch(/begin;[\s\S]*rollback;/i);
  });
});
