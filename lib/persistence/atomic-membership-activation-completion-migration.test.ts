import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration037 = readFileSync(
  new URL(
    "./supabase/migrations/037_stripe_setup_authorization.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration042 = readFileSync(
  new URL(
    "./supabase/migrations/042_atomic_membership_activation_completion.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./supabase/tests/042_atomic_membership_activation_completion.sql",
    import.meta.url,
  ),
  "utf8",
);
const integration = readFileSync(
  new URL(
    "./supabase/atomic-membership-activation-completion.integration.test.ts",
    import.meta.url,
  ),
  "utf8",
);
const schemaMirror = readFileSync(
  new URL("./supabase/schema.sql", import.meta.url),
  "utf8",
);

const completionTables = [
  "obligations",
  "obligation_events",
  "website_membership_sales",
] as const;
const browserRoles = ["anon", "authenticated"] as const;
const tablePrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

function activationRpc(source: string) {
  return (
    source.match(
      /create or replace function public\.activate_membership_after_stripe_setup\([\s\S]*?\n\$\$;/,
    )?.[0] ?? ""
  );
}

function expectOrdered(source: string, fragments: readonly string[]) {
  let previous = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, previous + 1);
    expect(next, `missing ordered SQL fragment: ${fragment}`).toBeGreaterThan(
      previous,
    );
    previous = next;
  }
}

const originalRpc = activationRpc(migration037);
const replacementRpc = activationRpc(migration042);

describe("migration 042 atomic membership activation completion", () => {
  it("preserves migration 037 identity, pricing, provider, and evidence checks", () => {
    for (const fragment of [
      "p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'",
      "p_stripe_setup_intent_id !~ '^seti_[A-Za-z0-9]+$'",
      "p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$'",
      "p_expected_authority_sha256 !~ '^[0-9a-f]{64}$'",
      "presentation_row.status is distinct from 'signed'",
      "agreement_row.status is distinct from 'complete'",
      "signing_attempt_row.status is distinct from 'complete'",
      "presentation_row.authority_sha256 is distinct from p_expected_authority_sha256",
      "presentation_row.quote_snapshot->>'authority' is distinct from 'atlas_pricing_engine_v1'",
      "attempt_row.customer_idempotency_key is distinct from",
      "attempt_row.setup_intent_idempotency_key is distinct from",
      "quote_visit_price is distinct from membership_row.visit_price",
      "attempt_row.visit_price is distinct from membership_row.visit_price",
      "attempt_row.enrollment_savings is distinct from quote_enrollment_savings",
      "operation_status in ('created', 'observed', 'ready')",
      "evidence_row.stripe_metadata is not distinct from expected_metadata",
      "evidence_row.stripe_setup_intent_status is not distinct from 'succeeded'",
    ]) {
      expect(originalRpc).toContain(fragment);
      expect(replacementRpc).toContain(fragment);
    }

    expectOrdered(replacementRpc, [
      "from public.memberships",
      "from public.presentations",
      "from public.signed_agreements",
      "from public.presentation_signing_attempts",
      "from public.homeowners",
      "from public.properties",
      "from public.membership_stripe_setup_reconciliation_attempts",
      "from public.membership_payment_setup_events",
      "from public.website_membership_sales",
      "from public.obligations",
    ]);
    expect(replacementRpc.match(/for key share;/g)).toHaveLength(4);
  });

  it("creates the complete durable set before publishing active/complete", () => {
    expectOrdered(replacementRpc, [
      "insert into public.membership_payment_setup_events",
      "insert into public.obligations",
      "insert into public.obligation_events",
      "insert into public.website_membership_sales",
      "update public.memberships",
      "set status = 'active'",
      "update public.presentations",
      "set onboarding_status = 'complete'",
    ]);
    expect(replacementRpc).toContain(
      "obligation_count := expected_visits_per_year",
    );
    expect(replacementRpc).toContain(
      "annualized_value := membership_row.visit_price * membership_row.visits_per_year",
    );
    expect(replacementRpc).not.toMatch(
      /(?:insert\s+into|update|delete\s+from)\s+public\.(?:pricing_settings|atlas_pricing_snapshots)/i,
    );
  });

  it("accepts only an exact complete replay while allowing later obligation status", () => {
    for (const fragment of [
      "obligation_count = expected_visits_per_year",
      "sale_row.annualized_value is not distinct from annualized_value",
      "sale_row.created_at is not distinct from evidence_row.payment_setup_completed_at",
      "obligation_row.created_at is distinct from evidence_row.payment_setup_completed_at",
      "activation_event_count <> 1",
      "activation_event_occurred_at is distinct from evidence_row.payment_setup_completed_at",
      "mismatched_activation_event_count <> 0",
      "'reason', 'activation_completion_incomplete_or_mismatched'",
    ]) {
      expect(replacementRpc).toContain(fragment);
    }
    expect(replacementRpc).not.toMatch(/obligation_row\.status\s+is\s+distinct/i);
    expect(replacementRpc).not.toMatch(/obligation_row\.memory_status\s+is\s+distinct/i);
  });

  it("matches the existing UTC month-overflow window derivation", () => {
    expect(replacementRpc).toContain(
      "activation_anchor := (locked_started_at at time zone 'UTC')::date",
    );
    expect(replacementRpc).toContain(
      "months => (obligation_sequence - 1) * months_per_window",
    );
    expect(replacementRpc).toContain(
      "days => extract(day from activation_anchor)::integer - 1",
    );
    expect(replacementRpc).toContain("window_end := next_window_start - 1");
  });

  it("makes sale and activation creation evidence immutable and service-only", () => {
    expect(migration042).toContain(
      "create unique index if not exists obligation_events_membership_activated_uidx",
    );
    expect(migration042).toContain(
      "create trigger obligation_events_membership_activated_immutable",
    );
    expect(migration042).toContain(
      "create trigger website_membership_sales_immutable",
    );
    expect(migration042).toContain(
      "grant select on table public.website_membership_sales to service_role",
    );
    for (const table of completionTables) {
      expect(migration042).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration042).toMatch(
      /revoke all on table\s+public\.obligations,\s+public\.obligation_events,\s+public\.website_membership_sales\s+from public, anon, authenticated, service_role;/,
    );
    expect(migration042).toContain(
      "grant select, insert, update on table public.obligations to service_role",
    );
    expect(migration042).toContain(
      "grant select, insert on table public.obligation_events to service_role",
    );
    expect(migration042).not.toMatch(
      /grant[^;]*delete[^;]*public\.(?:obligations|obligation_events|website_membership_sales)/i,
    );
    for (const fragment of [
      'drop policy if exists "obligations_anon_all" on public.obligations',
      'drop policy if exists "obligation_events_anon_all" on public.obligation_events',
      "'obligations', 'obligation_events', 'website_membership_sales'",
      "table_acl_mismatch_count",
      "browser_policy_count",
      "acl.is_grantable",
    ]) {
      expect(migration042).toContain(fragment);
    }
    expect(migration042).toMatch(
      /revoke all on function public\.activate_membership_after_stripe_setup\([\s\S]*?\) from public, anon, authenticated, service_role;/,
    );
    expect(migration042).toMatch(
      /grant execute on function public\.activate_membership_after_stripe_setup\([\s\S]*?\) to service_role;/,
    );
  });

  it("ships the required disposable failure and replay matrix", () => {
    for (const fragment of [
      "forced migration 042 sale failure",
      "partial state was not held",
      "mismatched replay was accepted",
      "legitimate status replay did not converge",
      "2026-01-31:2026-04-30",
      "2026-05-01:2026-07-30",
      "Migration 042 ACL rehearsal failed",
      "Migration 042 immutable evidence rehearsal failed",
      "rollback;",
    ]) {
      expect(rehearsal).toContain(fragment);
    }
    expect(integration).toContain("Promise.all([firstActivation, secondActivation])");
    expect(integration).toContain('new Set(["activated", "replay"])');
    expect(integration).toContain("sale_count: 1");
    expect(integration).toContain("obligation_count: 4");
    expect(integration).toContain("activation_event_count: 4");

    for (const role of browserRoles) {
      for (const table of completionTables) {
        for (const privilege of tablePrivileges) {
          expect(rehearsal).toContain(
            `('${role}'::name, 'public.${table}'::text, '${privilege}'::text)`,
          );
        }
      }
    }
  });

  it("mirrors the obligation ledger and 042 immutable evidence schema", () => {
    for (const fragment of [
      "create table if not exists obligations",
      "create table if not exists obligation_events",
      "obligation_events_membership_activated_uidx",
      "obligation_events_membership_activated_immutable",
      "website_membership_sales_immutable",
      "alter table obligations enable row level security",
      "alter table obligation_events enable row level security",
      "alter table website_membership_sales enable row level security",
      'drop policy if exists "obligations_anon_all" on obligations',
      'drop policy if exists "obligation_events_anon_all" on obligation_events',
      "revoke all on table obligations, obligation_events, website_membership_sales",
      "grant select, insert, update on obligations to service_role",
      "grant select, insert on obligation_events to service_role",
      "grant select on website_membership_sales to service_role",
    ]) {
      expect(schemaMirror).toContain(fragment);
    }
  });
});
