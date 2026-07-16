import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/038_jobber_schedule_coverage_sync.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./supabase/tests/038_jobber_schedule_coverage_sync.sql",
    import.meta.url,
  ),
  "utf8",
);
const applicationSources = [
  "../care-operations/jobber-coverage-provider.ts",
  "../care-operations/jobber-coverage-sync.ts",
  "../care-operations/jobber-coverage-store.ts",
  "../../app/api/admin/care-operations/jobber/sync/route.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

describe("migration 038 Jobber schedule coverage", () => {
  it("creates only additive RLS-protected, server-only coverage tables", () => {
    for (const table of [
      "jobber_schedule_sync_runs",
      "jobber_schedule_sync_partitions",
      "jobber_visit_source_observations",
      "jobber_schedule_sync_watermarks",
      "jobber_schedule_sync_locks",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toMatch(
      /revoke all on table public\.jobber_schedule_sync_runs,[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant select on table public\.jobber_schedule_sync_runs,[\s\S]*to service_role/,
    );
  });

  it("makes observations and partitions immutable and runs undeletable", () => {
    expect(migration).toMatch(
      /jobber_schedule_sync_partitions_immutable[\s\S]*before update or delete/,
    );
    expect(migration).toMatch(
      /jobber_visit_source_observations_immutable[\s\S]*before update or delete/,
    );
    expect(migration).toMatch(
      /jobber_schedule_sync_runs_no_delete[\s\S]*before delete/,
    );
    expect(migration).toContain(
      "Jobber schedule sync evidence is append-only and immutable",
    );
  });

  it("serializes a run, binds the actor, and uses service-role-only RPCs", () => {
    expect(migration).toContain("begin_jobber_schedule_coverage_sync");
    expect(migration).toContain("actor.user_id = requested_actor_id");
    expect(migration).toContain("actor.active = true");
    expect(migration).toContain("for update");
    expect(migration).toContain("active_run_id");
    expect(migration).toContain("lease_expires_at");
    expect(migration).toContain("renew_jobber_schedule_coverage_sync_lease");
    expect(migration).toMatch(
      /active_run_id = requested_run_id[\s\S]*lease_expires_at > changed_at/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.begin_jobber_schedule_coverage_sync[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.begin_jobber_schedule_coverage_sync[\s\S]*to service_role/,
    );
  });

  it("requires equal durable pass and leaf evidence before one atomic finalize", () => {
    const finalize = migration.match(
      /create or replace function public\.finalize_jobber_schedule_coverage_sync[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(finalize).toContain(
      "pass_one_manifest_sha256 <> run_row.pass_two_manifest_sha256",
    );
    expect(finalize).toContain(
      "pass_one_leaf_coverage_sha256 <> run_row.pass_two_leaf_coverage_sha256",
    );
    expect(finalize).toContain("full join");
    expect(finalize).toContain("insert into public.jobber_visit_projections");
    expect(finalize).toContain("insert into public.jobber_schedule_sync_watermarks");
    expect(finalize).toContain("generation = requested_expected_watermark_generation");
    expect(finalize).toContain("status = 'complete'");
  });

  it("reconciles an ambiguous finalize response only to the exact current watermark", () => {
    const reconcile = migration.match(
      /create or replace function public\.reconcile_jobber_schedule_coverage_finalization[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(reconcile).toContain("watermark.run_id = run.id");
    expect(reconcile).toContain("run.status = 'complete'");
    expect(reconcile).toContain("watermark.window_start = run.window_start");
    expect(reconcile).toContain("watermark.covered_at = run.completed_at");
    expect(reconcile).toContain(
      "watermark.generation = run.expected_watermark_generation + 1",
    );
    expect(reconcile).toContain("return 'not_completed'");
  });

  it("rejects stale projection observations and never infers absence", () => {
    expect(migration).toContain(
      "jobber_visit_projections.source_observed_at <= excluded.source_observed_at",
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+public\.jobber_visit_projections/i,
    );
    expect(migration).not.toMatch(
      /visit_status\s*=\s*['\"](?:cancelled|deleted)/i,
    );
  });

  it("has no writes or calls to forbidden HomeAtlas and provider domains", () => {
    for (const table of [
      "member_appointments",
      "obligations",
      "atlas_pricing_snapshots",
      "memberships",
      "signed_agreements",
      "property_visit_health_checks",
      "membership_billing_charges",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`, "i"),
      );
      expect(applicationSources).not.toContain(table);
    }
    expect(migration).not.toMatch(/stripe\s*\./i);
    expect(migration).not.toMatch(/mutation\s*\{/i);
    expect(applicationSources).not.toMatch(/mutation\s+[A-Za-z0-9_]+\s*\{/i);
  });

  it("ships a rollback-only SQL rehearsal for RLS, lock, CAS, immutability, and atomicity", () => {
    for (const fragment of [
      "begin;",
      "has_table_privilege('anon'",
      "has_function_privilege(",
      "'authenticated'",
      "append-only and immutable",
      "Concurrent Jobber sync lock was not rejected",
      "Expired Jobber worker unexpectedly renewed its lease",
      "Replaced Jobber worker unexpectedly renewed its lease",
      "Partial run changed the prior watermark",
      "Stale Jobber observation overwrote newer projection truth",
      "Stable finalize did not advance watermark atomically",
      "Committed finalization was not durably reconcilable",
      "Failed finalization incorrectly reconciled complete",
      "rollback;",
    ]) {
      expect(rehearsal).toContain(fragment);
    }
  });
});
