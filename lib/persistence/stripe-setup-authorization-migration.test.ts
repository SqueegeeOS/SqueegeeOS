import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/037_stripe_setup_authorization.sql",
    import.meta.url,
  ),
  "utf8",
);
const audit = readFileSync(
  new URL("../../scripts/audit-migrations.mjs", import.meta.url),
  "utf8",
);
const disposableHarness = readFileSync(
  new URL(
    "./supabase/stripe-setup-authorization.integration.test.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 037 Stripe setup authorization", () => {
  it("preserves the exact migration 042 activation successor on rerun", () => {
    const successorHash = "1bd1f881ce2df4652f3b9b0ca149ab89";
    const exactSignature = [
      "uuid",
      "uuid",
      "uuid",
      "uuid",
      "uuid",
      "text",
      "uuid",
      "text",
      "text",
      "text",
      "boolean",
    ];
    const guardStart = migration.indexOf(
      "-- Migration 042 replaces the exact signature below",
    );
    const guardedCreate = migration.indexOf(
      "create or replace function public.activate_membership_after_stripe_setup(",
      guardStart,
    );

    expect(guardStart).toBeGreaterThan(-1);
    expect(guardedCreate).toBeGreaterThan(guardStart);

    const preservationGuard = migration.slice(guardStart, guardedCreate);
    expect(preservationGuard).toContain(
      `'public.activate_membership_after_stripe_setup(${exactSignature.join(",")})'`,
    );
    expect(preservationGuard).toMatch(
      new RegExp(
        `\\)\\s+is distinct from '${successorHash}'\\s+then\\s+execute\\s+\\$migration_037_activation_ddl\\$`,
      ),
    );

    const exactDropPattern = new RegExp(
      `drop\\s+function\\s+if\\s+exists\\s+public\\.activate_membership_after_stripe_setup\\(\\s*${exactSignature.join(
        "\\s*,\\s*",
      )}\\s*\\)\\s*;`,
      "i",
    );
    expect(migration.slice(0, guardedCreate)).not.toMatch(exactDropPattern);
  });

  it("stores exclusive provider bindings and service-role transactional RPCs", () => {
    expect(migration).toContain("add column if not exists stripe_setup_intent_id");
    expect(migration).toContain("memberships_stripe_setup_intent_uidx");
    expect(migration).toContain("memberships_stripe_customer_uidx");
    expect(migration).toContain(
      "duplicate membership bindings require review",
    );
    expect(migration).toContain("stripe_customer_already_bound");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("claim_membership_stripe_setup");
    expect(migration).toContain("activate_membership_after_stripe_setup");
    expect(migration).toContain("reserve_membership_stripe_setup_reconciliation");
    expect(migration).toContain("append_membership_stripe_setup_reconciliation_event");
    expect(migration).toContain("p_expected_authority_sha256 text");
    expect(migration).toContain("security invoker");
    expect(migration).toMatch(
      /activate_membership_after_stripe_setup[\s\S]*security definer/,
    );
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toMatch(
      /revoke all on function public\.claim_membership_stripe_setup[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.activate_membership_after_stripe_setup[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.claim_membership_stripe_setup[\s\S]*to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.activate_membership_after_stripe_setup[\s\S]*to service_role/,
    );
  });

  it("reserves immutable server-only reconciliation before provider creation", () => {
    for (const fragment of [
      "membership_stripe_setup_reconciliation_attempts",
      "membership_stripe_setup_reconciliation_events",
      "capability_kind",
      "customer_idempotency_key",
      "setup_intent_idempotency_key",
      "operation_phase",
      "operation_status",
      "before_provider",
      "provider_reconciliation_missing",
      "p_reconciliation_attempt_id uuid",
      "reconciliation_attempt_id",
    ]) {
      expect(migration).toContain(fragment);
    }
    expect(migration).toMatch(
      /membership_stripe_setup_reconciliation_attempts_immutable[\s\S]*before update or delete/,
    );
    expect(migration).toMatch(
      /membership_stripe_setup_reconciliation_events_immutable[\s\S]*before update or delete/,
    );
  });

  it("writes immutable, service-only activation evidence", () => {
    expect(migration).toContain("membership_payment_setup_events");
    expect(migration).toContain(
      "alter table public.membership_payment_setup_events enable row level security",
    );
    expect(migration).toContain(
      "Stripe setup evidence is append-only and immutable",
    );
    expect(migration).toMatch(
      /before update or delete on public\.membership_payment_setup_events/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.membership_payment_setup_events[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant select on table public\.membership_payment_setup_events,[\s\S]*to service_role/,
    );
    expect(migration).not.toMatch(
      /grant[^;]*insert[^;]*membership_payment_setup_events/i,
    );
    for (const fragment of [
      "sales_tier",
      "visit_price",
      "visits_per_year",
      "presentation_authority_sha256",
      "enrollment_savings",
      "stripe_livemode",
      "stripe_setup_intent_status",
      "stripe_metadata",
      "evidence_row.stripe_metadata is not distinct from expected_metadata",
      "payment_setup_completed_at",
      "evidence_row.payment_setup_completed_at",
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("locks and rechecks every HomeAtlas link before activation", () => {
    for (const fragment of [
      "from public.memberships",
      "from public.presentations",
      "from public.signed_agreements",
      "from public.presentation_signing_attempts",
      "from public.homeowners",
      "from public.properties",
      "for update",
      "for key share",
      "membership_row.status is distinct from 'pending_payment'",
      "presentation_row.onboarding_status is distinct from 'pending_payment'",
      "agreement_row.status is distinct from 'complete'",
      "stripe_setup_intent_id is distinct from p_stripe_setup_intent_id",
      "signing_attempt_row.presentation_authority_sha256 is distinct from p_expected_authority_sha256",
      "agreement_row.agreement_tier is distinct from membership_row.sales_tier",
      "presentation_row.quote_snapshot->'tierVisitPrices'",
      "membership_row.visits_per_year is distinct from expected_visits_per_year",
      "membership_enrollment_savings = quote_enrollment_savings",
      "'sales_tier', membership_row.sales_tier",
      "'presentation_authority_sha256', p_expected_authority_sha256",
    ]) {
      expect(migration).toContain(fragment);
    }
    expect(migration).toMatch(
      /membership_row\.status = 'active'[\s\S]*'outcome', 'replay'/,
    );
    expect(migration).toContain("'outcome', 'held'");
    expect(migration).not.toMatch(/charge|payment_intent/i);
  });

  it("returns only the locked activation snapshot for downstream work", () => {
    for (const fragment of [
      "'membership_id', membership_row.id",
      "'presentation_id', presentation_row.id",
      "'agreement_id', agreement_row.id",
      "'homeowner_id', membership_row.homeowner_id",
      "'property_id', membership_row.property_id",
      "'sales_tier', evidence_row.sales_tier",
      "'visit_price', evidence_row.visit_price",
      "'visits_per_year', evidence_row.visits_per_year",
      "'started_at', membership_row.started_at",
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("audits exact function, ACL, evidence-constraint, and trigger definitions", () => {
    for (const fragment of [
      "stripeSetupEvidenceConstraintsExact",
      "stripeSetupColumnsExact",
      "stripeSetupFunctionDefinitionsExact",
      "stripeSetupTriggerExact",
      "expectedConstraintDefinitions",
      "normalizeConstraintDefinition",
      "expectedFunctionBody",
      "pg_catalog.oidvectortypes(p.proargtypes)",
      "p.proargnames as argument_names",
      "p.prosrc as body",
      "pg_get_triggerdef(t.oid, false)",
      "numeric_precision",
      "column_default",
      "argument_defaults",
      "security_definer",
      "is_strict",
      "parallel_mode",
      "search_path=pg_catalog",
      "uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean",
    ]) {
      expect(audit).toContain(fragment);
    }
  });

  it("gates a real 036→037 rerun, ACL, concurrency, and locked-term harness", () => {
    for (const fragment of [
      "PR1C_DISPOSABLE_DB_ACK",
      "await pool.query(migration036)",
      "await pool.query(migration037)",
      "has_table_privilege('anon'",
      "has_function_privilege('authenticated'",
      "Promise.all",
      "pg_advisory_lock",
      "firstClaim",
      "secondClaim",
      "claims.filter((result) => result.outcome === \"claimed\")",
      "claims.filter((result) => result.outcome === \"held\")",
      "Malformed PR1c reconciliation schema requires review",
      "Malformed PR1c constraint definitions require review",
      "Malformed PR1c function definitions require review",
      "EXPECTED_COLUMN_SIGNATURES",
      "EXPECTED_CONSTRAINT_DEFINITIONS",
      "append-only and immutable",
      "queuedActivation",
      "signed_pricing_authority_changed",
      "stripe_customer_id: null",
      "stripe_setup_intent_id: null",
      "stripe_payment_method_id: null",
      "started_at: null",
      "payment_setup_completed_at: null",
      "membership_enrollment_savings: null",
      "evidence_count: 0",
      "sale_count: 0",
      "obligation_count: 0",
    ]) {
      expect(disposableHarness).toContain(fragment);
    }
  });
});
