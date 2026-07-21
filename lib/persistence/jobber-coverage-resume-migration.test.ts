import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/045_jobber_coverage_resume.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL("./supabase/tests/045_jobber_coverage_resume.sql", import.meta.url),
  "utf8",
);
const audit = readFileSync(
  new URL("../../scripts/audit-migrations.mjs", import.meta.url),
  "utf8",
);
const integration = readFileSync(
  new URL(
    "./supabase/jobber-coverage-resume.integration.test.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 045 resumable Jobber coverage", () => {
  it("adds an RLS-protected frontier and immutable attempt reservations", () => {
    for (const table of [
      "jobber_schedule_sync_work_items",
      "jobber_schedule_sync_request_attempts",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain(
      "Jobber schedule sync request attempts are append-only and immutable",
    );
    expect(migration).toMatch(
      /jobber_schedule_sync_request_attempts_immutable[\s\S]*before update or delete/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.jobber_schedule_sync_work_items,[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant select on table public\.jobber_schedule_sync_work_items,[\s\S]*to service_role/,
    );
  });

  it("reserves provider attempts before work and safely replays interrupted work", () => {
    const reserve = migration.match(
      /create or replace function public\.reserve_jobber_schedule_coverage_attempt[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    const start = migration.match(
      /create or replace function public\.start_or_resume_jobber_schedule_coverage_sync[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(reserve.indexOf("insert into public.jobber_schedule_sync_request_attempts"))
      .toBeLessThan(reserve.indexOf("set work_state = 'in_progress'"));
    expect(reserve).toContain("set request_count = request_count + 1");
    expect(start).toContain("work_state = 'pending', attempt_id = null");
    expect(start).toContain("result_outcome := 'resumed'");
    expect(start).toContain("selected_run.window_start");
  });

  it("keeps deterministic half-open partitioning and two durable stable passes", () => {
    expect(migration).toContain("partition_path ~ '^r[01]*$'");
    expect(migration).toContain("midpoint_ms := start_ms + ((end_ms - start_ms) / 2)");
    expect(migration).toContain("requested_left_end <> expected_midpoint");
    expect(migration).toContain("requested_right_start <> expected_midpoint");
    expect(migration).toContain("pass_one_manifest_sha256");
    expect(migration).toContain("pass_two_manifest_sha256");
    expect(migration).toContain("finalize_jobber_schedule_coverage_sync(");
    expect(migration).not.toMatch(/\bafter\b\s*:/i);
  });

  it("narrows manifest omission to the completed window and fails closed atomically", () => {
    const manifestFence = migration.match(
      /create or replace function public\.invalidate_jobber_visit_classification_on_manifest_omission[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(manifestFence).toContain(
      "classification.scheduled_start >= new.window_start",
    );
    expect(manifestFence).toContain(
      "classification.scheduled_start < new.window_end",
    );
    expect(manifestFence).toContain("observation.pass_number = 2");
    expect(manifestFence).toContain("classification_count <> 1");
    expect(manifestFence).toContain("appointment_count <> 1");
    expect(manifestFence).toContain(
      "expected exactly one bound authoritative appointment",
    );
    expect(manifestFence).toContain(
      "appointment.jobber_authority_state is not distinct from 'approved'",
    );
    expect(manifestFence.indexOf("update public.member_appointments"))
      .toBeLessThan(
        manifestFence.indexOf(
          "insert into public.jobber_visit_classification_events",
        ),
      );
    expect(manifestFence).not.toContain("set status =");
    expect(manifestFence).not.toContain("set completed_at =");
    expect(manifestFence).not.toMatch(/delete\s+from/i);
  });

  it("makes the invocation boundary recoverable without advancing coverage", () => {
    expect(migration).toContain("'awaiting_continuation'");
    expect(migration).toContain("continuation_paused_at");
    expect(migration).not.toContain("'query_cap_reached', 14");
    const pause = migration.match(
      /create or replace function public\.pause_jobber_schedule_coverage_sync[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(pause).toContain("status = 'awaiting_continuation'");
    expect(pause).toContain("active_run_id = null");
    expect(pause).not.toContain("jobber_schedule_sync_watermarks");
  });

  it("keeps every mutation acquisition-fenced and removes legacy service-role mutation access", () => {
    const ownerAssertion = migration.match(
      /create or replace function public\.assert_resumable_jobber_schedule_sync_owner[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(ownerAssertion).toContain("actor.active = true");
    expect(ownerAssertion).toContain("actor.role in ('owner', 'operator')");
    expect(ownerAssertion).toContain(
      "sync_lock.acquisition_generation = requested_acquisition_generation",
    );
    expect(ownerAssertion).toContain(
      "sync_lock.owner_token = requested_owner_token",
    );

    const start = migration.match(
      /create or replace function public\.start_or_resume_jobber_schedule_coverage_sync[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    const pause = migration.match(
      /create or replace function public\.pause_jobber_schedule_coverage_sync[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    for (const body of [start, ownerAssertion, pause]) {
      const connectionLock = body.indexOf(
        "from public.jobber_schedule_sync_locks sync_lock",
      );
      const connectionLockForUpdate = body.indexOf("for update", connectionLock);
      const runLock = body.indexOf(
        "from public.jobber_schedule_sync_runs run",
        connectionLock,
      );
      const runLockForUpdate = body.indexOf("for update", runLock);
      expect(connectionLock).toBeGreaterThan(-1);
      expect(connectionLockForUpdate).toBeGreaterThan(connectionLock);
      expect(runLock).toBeGreaterThan(connectionLockForUpdate);
      expect(runLockForUpdate).toBeGreaterThan(runLock);
    }

    for (const functionName of [
      "renew_resumable_jobber_schedule_coverage_sync_lease",
      "reserve_jobber_schedule_coverage_attempt",
      "record_jobber_schedule_coverage_overflow",
      "record_jobber_schedule_coverage_leaf",
      "complete_resumable_jobber_schedule_coverage_pass",
      "mark_resumable_jobber_schedule_coverage_sync_partial",
      "finalize_resumable_jobber_schedule_coverage_sync",
    ]) {
      const body = migration.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
        ),
      )?.[0] ?? "";
      expect(body).toContain("requested_acquisition_generation bigint");
      expect(body).toContain("requested_owner_token uuid");
      expect(body).toContain("assert_resumable_jobber_schedule_sync_owner");
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated, service_role`,
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${functionName}[\\s\\S]*?to service_role`,
        ),
      );
    }

    expect(pause).toContain(
      "lock_row.acquisition_generation <> requested_acquisition_generation",
    );
    expect(pause).toContain("lock_row.owner_token <> requested_owner_token");
    expect(pause).toContain("lock_row.active_run_id is null");

    expect(start).toContain("acquisition_generation = acquisition_generation + 1");
    expect(start).toContain("owner_token = pg_catalog.gen_random_uuid()");

    for (const legacyName of [
      "begin_jobber_schedule_coverage_sync",
      "renew_jobber_schedule_coverage_sync_lease",
      "append_jobber_schedule_coverage_leaf",
      "complete_jobber_schedule_coverage_pass",
      "finalize_jobber_schedule_coverage_sync",
      "mark_jobber_schedule_coverage_sync_partial",
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${legacyName}`),
      );
    }
    expect(audit).toContain("pg_catalog.has_function_privilege(");
    expect(audit).toContain("checked_roles.role_name");
    expect(audit).toContain("where acl.grantee = 0");
  });

  it("contains no direct writes or calls to forbidden customer, money, or authority domains", () => {
    for (const table of [
      "obligations",
      "obligation_events",
      "atlas_pricing_snapshots",
      "pricing_settings",
      "billing_orders",
      "membership_billing_charges",
      "memberships",
      "signed_agreements",
      "property_assets",
      "property_visit_health_checks",
      "service_observations",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(
          `(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`,
          "i",
        ),
      );
    }
    expect(migration).not.toMatch(/stripe\s*\./i);
    expect(migration).not.toMatch(/mutation\s*\{/i);
  });

  it("ships rollback-only exact-cap, continuation, crash, concurrency, and fingerprint evidence", () => {
    for (const fragment of [
      "begin;",
      "rollback;",
      "Migration 045 did not replay interrupted in-progress work",
      "Migration 045 did not transition durably to pass two",
      "Migration 045 advanced the watermark before finalization",
      "Migration 045 stable two-pass finalization failed",
      "Migration 045 did not checkpoint exactly fourteen attempts",
      "Migration 045 re-fetched an already completed leaf",
      "Migration 045 concurrent resume did not preserve one owner",
      "Stale worker unexpectedly renewed after takeover",
      "Stale worker unexpectedly paused after takeover",
      "Stale worker unexpectedly finalized after takeover",
      "Stale worker unexpectedly marked partial after takeover",
      "Migration 045 retained effective access to a legacy unfenced mutator",
      "Migration 045 changed an out-of-window classification",
      "Migration 045 changed a visit included in pass two",
      "Migration 045 duplicated omission evidence on completion replay",
      "capture_forbidden_domain_content(\n      'manifest_omission_before'",
      "assert_forbidden_domain_content_unchanged(\n      'manifest_omission_before', 'manifest_omission_after'",
      "'status', appointment.status",
      "'provenance_state', appointment.provenance_state",
      "'matched_obligation_id', appointment.matched_obligation_id",
      "'jobber_visit_classification_id'",
      "Migration 045 changed appointment lifecycle or provenance during omission demotion",
      "Migration 045 binding mismatch did not roll back atomically",
      "capture_forbidden_domain_content('before')",
      "assert_forbidden_domain_content_unchanged('before', 'after')",
    ]) {
      expect(rehearsal).toContain(fragment);
    }
    expect(audit).toContain('"045", "resumable Jobber schedule coverage"');
  });

  it("ships opt-in deterministic two-session takeover and lock-order harnesses", () => {
    expect(integration).toContain("max: 2");
    expect(integration).toContain("pool.connect()");
    expect(integration).toContain("takeoverBarrier");
    expect(integration).toContain("pg_catalog.pg_blocking_pids");
    expect(integration).toContain('not.toBe("40P01")');
    expect(integration).toContain(
      "renew_resumable_jobber_schedule_coverage_sync_lease",
    );
    expect(integration).toContain("record_jobber_schedule_coverage_leaf");
    expect(integration).toContain("ownership fence was lost");
  });
});
