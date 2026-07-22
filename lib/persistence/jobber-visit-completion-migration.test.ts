import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/043_authoritative_visit_completion_evidence.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./supabase/tests/043_authoritative_visit_completion_evidence.sql",
    import.meta.url,
  ),
  "utf8",
);
const fingerprintUtility = readFileSync(
  new URL(
    "./supabase/tests/support/forbidden_domain_fingerprints.sql",
    import.meta.url,
  ),
  "utf8",
);
const concurrencyHarness = readFileSync(
  new URL(
    "./supabase/jobber-visit-completion-concurrency.integration.test.ts",
    import.meta.url,
  ),
  "utf8",
);
const concurrencyCleanup = readFileSync(
  new URL(
    "./supabase/tests/support/043_authoritative_visit_completion_concurrency_cleanup.sql",
    import.meta.url,
  ),
  "utf8",
);
const concurrencyFixture = readFileSync(
  new URL(
    "./supabase/tests/support/043_authoritative_visit_completion_concurrency_fixture.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 043 authoritative visit completion and evidence", () => {
  it("creates RLS-protected immutable completion and text-only evidence ledgers", () => {
    for (const table of [
      "jobber_visit_completion_events",
      "visit_text_evidence",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("append-only and immutable");
    expect(migration).toContain("jobber_visit_completion_events_immutable");
    expect(migration).toContain("visit_text_evidence_immutable");
    expect(migration).toMatch(
      /revoke all on table public\.jobber_visit_completion_events,[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant select on table public\.jobber_visit_completion_events,[\s\S]*to service_role/,
    );
  });

  it("accepts only internally consistent verified provider completion", () => {
    const confirm = migration.match(
      /create or replace function public\.confirm_jobber_visit_completion[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    for (const fragment of [
      "projection_row.visit_status <> 'COMPLETED'",
      "projection_row.is_complete is distinct from true",
      "projection_row.completed_at is null",
      "projection_row.completed_at > changed_at",
      "projection_row.completed_at > projection_row.source_observed_at",
      "projection_row.source_payload_hash <> requested_source_payload_hash",
      "observation.source_payload_hash = projection_row.source_payload_hash",
      "observation.source_observed_at = projection_row.source_observed_at",
      "order by latest.reservation_sequence desc",
      "sync_lock_row.active_run_id is not null",
      "connection_row.id <> 'squeegeeking'",
      "connection_row.status <> 'connected'",
      "connection_row.graphql_version <> '2025-04-16'",
      "coverage_run_row.graphql_version <> '2025-04-16'",
      "watermark_row.covered_at < changed_at - pg_catalog.make_interval(mins => 30)",
    ]) {
      expect(confirm).toContain(fragment);
    }
  });

  it("revalidates prior approval, current link/version, exact identity, and strict membership", () => {
    const confirm = migration.match(
      /create or replace function public\.confirm_jobber_visit_completion[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    for (const fragment of [
      "actor.active = true",
      "actor.role in ('owner', 'operator')",
      "link_row.link_state <> 'active'",
      "link_row.updated_at <> requested_property_link_updated_at",
      "link_row.connection_id <> projection_row.connection_id",
      "link_row.external_property_id <> projection_row.external_property_id",
      "membership_row.status <> 'active'",
      "membership_row.payment_setup_completed_at is null",
      "agreement.status = 'complete'",
      "classification_row.classification_state <> 'pending_review'",
      "latest_classification_event.event_type <> 'source_invalidated'",
      "approved.event_type = 'approved'",
      "appointment_row.jobber_visit_classification_id <> classification_row.id",
      "appointment_row.matched_obligation_id is not null",
      "appointment_row.status <> 'scheduled'",
    ]) {
      expect(confirm).toContain(fragment);
    }
    expect(confirm).toMatch(
      /from public\.hq_admin_users actor[\s\S]*for share;[\s\S]*from public\.jobber_connections connection[\s\S]*for share;[\s\S]*from public\.jobber_schedule_sync_locks sync_lock[\s\S]*for update;[\s\S]*from public\.jobber_visit_projections projection[\s\S]*for update;[\s\S]*from public\.jobber_property_links property_link[\s\S]*for update;[\s\S]*from public\.memberships membership[\s\S]*for update;[\s\S]*from public\.jobber_schedule_sync_watermarks watermark[\s\S]*for update;[\s\S]*from public\.jobber_visit_classifications classification[\s\S]*for update;[\s\S]*from public\.member_appointments appointment[\s\S]*for update;/,
    );
  });

  it("updates only the same appointment and appends one idempotent authority event", () => {
    expect(migration).toContain("appointment_id uuid not null unique");
    expect(migration).toContain("classification_id uuid not null unique");
    expect(migration).toMatch(
      /update public\.member_appointments[\s\S]*where id = appointment_row\.id/,
    );
    expect(migration).not.toMatch(/insert into public\.member_appointments/i);
    expect(migration).toContain("'outcome', 'replay'");
    expect(migration).toContain("completion_row.actor_id <> requested_actor_id");
    expect(migration).toContain("completion_row.reason <> normalized_reason");
    expect(migration).toContain("normalized_reason, classification_row.projection_snapshot");
    expect(migration).toContain("jobber_authority_state = 'completed'");
  });

  it("derives text evidence property and membership server-side", () => {
    const append = migration.match(
      /create or replace function public\.append_visit_text_evidence[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    expect(append).not.toContain("requested_property_id");
    expect(append).not.toContain("requested_membership_id");
    expect(append).toContain("completion_row.property_id");
    expect(append).toContain("completion_row.membership_id");
    expect(append).toContain("appointment_row.status <> 'completed'");
    expect(append).toContain("evidence_row.evidence_text <>");
  });

  it("writes no money, obligation, agreement, customer-publication, asset, or AI domain", () => {
    for (const table of [
      "obligations",
      "obligation_events",
      "atlas_pricing_snapshots",
      "billing_orders",
      "membership_billing_charges",
      "member_addon_transactions",
      "memberships",
      "signed_agreements",
      "property_assets",
      "service_observations",
      "property_visit_health_checks",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`, "i"),
      );
    }
    expect(migration).not.toMatch(/stripe\s*\./i);
    expect(migration).not.toMatch(/openai|embedding|image[_ ]?generation/i);
  });

  it("ships a rollback-only SQL rehearsal covering failure and replay contracts", () => {
    for (const fragment of [
      "begin;",
      "has_table_privilege('anon'",
      "has_function_privilege('anon'",
      "COMPLETED",
      "Unknown provider completion state was accepted",
      "Contradictory completion flag was accepted",
      "Missing completion timestamp was accepted",
      "Stale source hash was accepted",
      "Revoked property link was accepted",
      "Inactive membership was accepted",
      "Stale coverage was accepted",
      "Disconnected Jobber connection was accepted",
      "Wrong Jobber connection GraphQL version was accepted",
      "Wrong coverage GraphQL provenance was accepted",
      "Concurrent or replay completion duplicated authority evidence",
      "Completion replay accepted a different reason",
      "Completion replay accepted a different actor",
      "Completion created a second appointment",
      "Browser-selected evidence scope was possible",
      "Text evidence mutation was accepted",
      "pg_temp.assert_forbidden_domain_content_unchanged('before', 'after')",
      "rollback;",
    ]) {
      expect(rehearsal).toContain(fragment);
    }
    expect(rehearsal).toContain("'squeegeeking', 'connected'");
    expect(rehearsal).not.toMatch(/'completion-043'\s*,\s*'connected'/);
  });

  it("seeds approved classifications only after their appointments exist", () => {
    for (const fixture of [rehearsal, concurrencyFixture]) {
      const classificationInsert = fixture.indexOf(
        "insert into public.jobber_visit_classifications",
      );
      const appointmentInsert = fixture.indexOf(
        "insert into public.member_appointments",
        classificationInsert,
      );
      const approvalUpdate = fixture.indexOf(
        "update public.jobber_visit_classifications",
        appointmentInsert,
      );
      const initialClassification = fixture.slice(
        classificationInsert,
        appointmentInsert,
      );
      const approval = fixture.slice(
        approvalUpdate,
        fixture.indexOf(";", approvalUpdate),
      );

      expect(classificationInsert).toBeGreaterThan(-1);
      expect(appointmentInsert).toBeGreaterThan(classificationInsert);
      expect(approvalUpdate).toBeGreaterThan(appointmentInsert);
      expect(initialClassification).toContain("'pending_review'");
      expect(initialClassification).toMatch(
        /scheduled_start, appointment_id, decided_at,\s+approved_at, updated_at[\s\S]*?now\(\) - interval '1 hour', null, now\(\) - interval '1 hour',\s+null, now\(\) - interval '1 hour'/,
      );
      expect(approval).toMatch(
        /set classification_state = 'approved',\s+appointment_id = '[0-9a-f-]+',\s+approved_at = now\(\) - interval '1 hour'/,
      );
    }
  });

  it("fingerprints deterministic content for every present forbidden domain", () => {
    for (const fragment of [
      "forbidden_domain_content_fingerprints",
      "pg_temp.capture_forbidden_domain_content('before')",
      "pg_temp.capture_forbidden_domain_content('after')",
      "pg_catalog.to_regclass(relation_name)",
      "pg_catalog.to_jsonb(source_row)",
      "pg_catalog.string_agg(row_data::text",
      "extension.extname = 'pgcrypto'",
      "%I.digest",
      "'sha256'",
      "full join",
      "relation_present is distinct from",
      "row_count is distinct from",
      "content_sha256 is distinct from",
    ]) {
      expect(`${rehearsal}\n${fingerprintUtility}`).toContain(fragment);
    }
    for (const relation of [
      "public.obligations",
      "public.obligation_events",
      "public.pricing_settings",
      "public.atlas_pricing_snapshots",
      "public.billing_orders",
      "public.billing_order_events",
      "public.membership_billing_charges",
      "public.stripe_event_ledger",
      "public.payment_reconciliation_cases",
      "public.membership_payment_setup_events",
      "public.membership_stripe_setup_reconciliation_attempts",
      "public.membership_stripe_setup_reconciliation_events",
      "public.signed_agreements",
      "public.presentation_signing_attempts",
      "public.memberships",
      "public.member_savings_transactions",
      "public.member_savings_ledger_entries",
      "public.member_referral_rewards",
      "public.referral_codes",
      "public.referral_visits",
      "public.referrals",
      "public.member_addon_transactions",
      "public.property_assets",
      "storage.objects",
      "public.property_visit_health_checks",
      "public.property_assessments",
      "public.service_observations",
      "public.properties",
      "public.homeowners",
      "public.home_care_plans",
      "public.presentations",
      "public.website_membership_sales",
      "public.ai_quotes",
      "public.appointment_source_events",
    ]) {
      expect(fingerprintUtility).toContain(`'${relation}'`);
    }
    expect(fingerprintUtility).not.toContain(
      "select jsonb_build_object(\n    'obligations'",
    );
    expect(rehearsal).toContain(
      "\\ir support/forbidden_domain_fingerprints.sql",
    );
  });

  it("ships an opt-in true two-session consolidated completion race matrix", () => {
    for (const fragment of [
      "expect(firstPid).not.toBe(secondPid)",
      "pg_catalog.pg_blocking_pids",
      "beginCoverageSync(context.second)",
      "finalize_jobber_schedule_coverage_sync",
      "revokePropertyLink(context.first",
      "set active = false",
      "set status = 'paused'",
      "set status = 'cancelled'",
      'expect(replay.value.outcome).toBe("replay")',
      "expectOneCompletedIdentity",
      "captureForbiddenDomainFingerprints",
      "assertForbiddenDomainFingerprintsUnchanged",
      "loadAuthoritativeRaceState",
      "expectPendingWithoutCompletion",
      'completionEventCount: "0"',
      'completionEventCount: "1"',
      "syncActiveRunId",
      "watermarkGeneration",
      "revokedLinkEventCount",
      "actorActive",
      "membershipStatus",
    ]) {
      expect(concurrencyHarness).toContain(fragment);
    }
    expect(concurrencyHarness).toMatch(
      /it\("serializes completion before a new PR2 sync reservation"[\s\S]*?await context\.first\.query\("commit"\);[\s\S]*?await context\.second\.query\("commit"\);[\s\S]*?expectOneCompletedIdentity\(state\)/,
    );
  });

  it("guards committed concurrency cleanup before every deletion", () => {
    expect(concurrencyCleanup).toMatch(
      /where id = 'squeegeeking'\s+and account_id is distinct from 'disposable-concurrency-043'/,
    );
    const guardIndex = concurrencyCleanup.indexOf("account_id is distinct from");
    const replicaModeIndex = concurrencyCleanup.indexOf(
      "set local session_replication_role = replica",
    );
    const firstDeleteIndex = concurrencyCleanup.indexOf("delete from");
    expect(guardIndex).toBeGreaterThan(concurrencyCleanup.indexOf("begin;"));
    expect(replicaModeIndex).toBeGreaterThan(guardIndex);
    expect(firstDeleteIndex).toBeGreaterThan(guardIndex);
    for (const fragment of [
      "refuses cleanup before deleting any non-marker canonical connection fixture",
      "loadCleanupSentinels",
      "expect(afterCleanup).toEqual(beforeCleanup)",
      'nonMarkerAccountIds.push(null)',
      "is_nullable",
    ]) {
      expect(concurrencyHarness).toContain(fragment);
    }
  });
});
