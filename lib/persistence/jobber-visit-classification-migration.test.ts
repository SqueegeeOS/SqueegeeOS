import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HQ_MEMBERSHIP_APPOINTMENT_TYPES } from "@/lib/membership/membership-appointment-types";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/039_jobber_visit_classification.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./supabase/tests/039_jobber_visit_classification.sql",
    import.meta.url,
  ),
  "utf8",
);
const coverageStore = readFileSync(
  new URL("../care-operations/jobber-coverage-store.ts", import.meta.url),
  "utf8",
);

describe("migration 039 Jobber visit classification", () => {
  it("creates RLS-protected current authority and immutable decision events", () => {
    for (const table of [
      "jobber_visit_classifications",
      "jobber_visit_classification_events",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("append-only and immutable");
    expect(migration).toContain("must be revoked, never deleted");
    expect(migration).toMatch(
      /revoke all on table public\.jobber_visit_classifications,[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant select on table public\.jobber_visit_classifications,[\s\S]*to service_role/,
    );
  });

  it("keeps the SQL allowlist synchronized with isMembershipAppointmentType", () => {
    for (const option of HQ_MEMBERSHIP_APPOINTMENT_TYPES) {
      expect(migration).toContain(`'${option.id}'`);
    }
    expect(migration).not.toContain("projection_row.title = requested_service_type");
  });

  it("atomically checks exact source, link, connection, property, membership, and actor", () => {
    const decide = migration.match(
      /create or replace function public\.decide_jobber_visit_classification[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    const revoke = migration.match(
      /create or replace function public\.revoke_jobber_visit_classification[\s\S]*?\n\$\$;/,
    )?.[0] ?? "";
    for (const fragment of [
      "actor.active = true",
      "projection_row.source_payload_hash <> requested_source_payload_hash",
      "link_row.updated_at <> requested_property_link_updated_at",
      "link_row.connection_id <> projection_row.connection_id",
      "link_row.external_property_id <> projection_row.external_property_id",
      "membership.property_id = requested_property_id",
      "agreement.status = 'complete'",
      "agreement.membership_id = membership_row.id",
      "observation.source_payload_hash = projection_row.source_payload_hash",
      "observation.source_observed_at = projection_row.source_observed_at",
      "watermark_row.covered_at < changed_at - pg_catalog.make_interval(mins => 30)",
      "sync_lock_row.active_run_id is not null",
      "projection_row.visit_status <> 'UPCOMING'",
      "projection_row.is_complete is distinct from false",
      "projection_row.completed_at is not null",
      "projection_row.scheduled_start <= changed_at",
      "appointment_row.matched_obligation_id is not null",
      "pg_catalog.pg_advisory_xact_lock",
      "appointment_row.member_profile_id is distinct from profile_id",
      "appointment_row.jobber_connection_id is distinct from projection_row.connection_id",
      "appointment_row.jobber_projection_id is distinct from projection_row.id",
      "appointment_row.jobber_property_link_id is distinct from link_row.id",
      "appointment_row.jobber_membership_id is distinct from membership_row.id",
    ]) {
      expect(decide).toContain(fragment);
    }
    expect(decide).toMatch(
      /from public\.hq_admin_users actor[\s\S]*for share;[\s\S]*from public\.jobber_schedule_sync_locks sync_lock[\s\S]*for update;[\s\S]*from public\.jobber_visit_projections projection[\s\S]*for update;/,
    );
    expect(revoke).toMatch(
      /from public\.hq_admin_users actor[\s\S]*for share;[\s\S]*from public\.jobber_visit_classifications classification[\s\S]*for update;/,
    );
    expect(revoke).toMatch(
      /from public\.member_appointments appointment[\s\S]*for update;[\s\S]*Appointment ownership changed before revocation/,
    );
    expect(revoke).toContain(
      "appointment_row.jobber_visit_classification_id is distinct from classification_row.id",
    );
    expect(decide).not.toContain("on conflict (provider, external_id)");
    expect(decide).not.toContain("technician_name = null");
    expect(decide).not.toContain("notes = null");
    expect(decide).toContain("requested_action is null");
    expect(rehearsal).toContain("Null classification action was accepted");
    expect(rehearsal).toContain(
      "Null classification action wrote authority evidence",
    );
  });

  it("orders coverage attempts by a post-lock monotonic reservation sequence", () => {
    expect(migration).toContain(
      "create sequence if not exists public.jobber_schedule_sync_reservation_sequence",
    );
    expect(migration).toContain(
      "alter column reservation_sequence set not null",
    );
    expect(migration).toMatch(
      /revoke all on sequence public\.jobber_schedule_sync_reservation_sequence\s+from public, anon, authenticated, service_role/,
    );
    expect(migration).toContain(
      "order by latest.reservation_sequence desc",
    );
    expect(migration).not.toContain(
      "order by latest.started_at desc, latest.id desc",
    );
    expect(coverageStore).toContain(
      '.order("reservation_sequence", { ascending: false })',
    );
    expect(coverageStore).not.toContain(
      '.order("started_at", { ascending: false })',
    );
    expect(rehearsal).toContain("Causally later partial coverage was accepted");
  });

  it("detaches historical appointment evidence before changed-evidence rejection", () => {
    expect(migration).toContain("'binding_detached'");
    expect(migration).toContain(
      "Prior appointment identity detached before classification rebinding",
    );
    expect(migration).toContain(
      "Appointment ownership changed before rejection",
    );
    expect(migration).toContain(
      "appointment_id = classification_row.appointment_id",
    );
    expect(migration).toMatch(
      /Prior appointment binding changed before classification rebinding[\s\S]*set jobber_visit_classification_id = null,[\s\S]*jobber_authority_state = 'pending_review'/,
    );
    expect(migration).toContain(
      "old_membership.homeowner_id = old_profile.homeowner_id",
    );
    expect(migration).toContain(
      "appointment_row.source_payload_hash is distinct from classification_row.source_payload_hash",
    );
    expect(migration).toMatch(
      /not is_approval[\s\S]*classification_row\.source_payload_hash is distinct from projection_row\.source_payload_hash[\s\S]*classification_row\.property_link_updated_at is distinct from link_row\.updated_at/,
    );
    expect(rehearsal).toContain(
      "Same-home source-change rejection rewrote or mispaired the prior appointment",
    );
    expect(rehearsal).toContain(
      "Same-home link-token rejection rewrote or mispaired the prior appointment",
    );
    expect(rehearsal).toContain(
      "Rejection after different-home relink mutated or mispaired the prior appointment",
    );
    expect(migration).toMatch(
      /update public\.member_appointments[\s\S]*jobber_visit_classification_id = classification_row\.id[\s\S]*jobber_membership_id = membership_row\.id/,
    );
  });

  it("demotes authority on source, property-link, or complete-manifest omission without cancellation", () => {
    expect(migration).toContain("jobber_visit_classifications_source_fence");
    expect(migration).toContain("jobber_visit_classifications_link_fence");
    expect(migration).toContain("jobber_visit_classifications_manifest_fence");
    expect(migration).toContain("manifest_omission_invalidated");
    expect(migration).toContain("jobber_authority_state = 'pending_review'");
    expect(migration).not.toMatch(/set\s+status\s*=\s*'cancelled'/i);
    expect(migration).not.toMatch(/set\s+completed_at\s*=/i);
  });

  it("writes no forbidden operational or money domain", () => {
    for (const table of [
      "obligations",
      "atlas_pricing_snapshots",
      "billing_orders",
      "membership_billing_charges",
      "member_addon_transactions",
      "property_assets",
      "service_observations",
      "memberships",
      "signed_agreements",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`, "i"),
      );
    }
    expect(migration).not.toMatch(/stripe\s*\./i);
  });

  it("ships a rollback-only SQL harness for authority, replay, stale evidence, and revocation", () => {
    for (const fragment of [
      "begin;",
      "has_table_privilege('anon'",
      "has_function_privilege(",
      "has_sequence_privilege(",
      "Replay created a duplicate classification or appointment",
      "Stale source hash was accepted",
      "Stale property-link token was accepted",
      "Current complete manifest omission left appointment authoritative",
      "Same-connection same-ID appointment was rebound to another home",
      "Cross-connection same-ID appointment was rebound",
      "Inactive Headquarters actor was accepted",
      "Membership mismatch was accepted",
      "Stale coverage was accepted",
      "Expired unfinished sync reservation was ignored",
      "Causally later partial coverage was accepted",
      "revoke_jobber_visit_classification",
      "Source change duplicated, commandeered, or cleared existing appointment detail",
      "Property-link revocation left appointment authoritative",
      "Classification revocation deleted decision evidence",
      "Drifted appointment authority was revoked",
      "Rejection after different-home relink mutated or mispaired the prior appointment",
      "approval-vs-begin/finalize",
      "approval-vs-deactivation",
      "rollback;",
    ]) {
      expect(rehearsal).toContain(fragment);
    }
  });
});
