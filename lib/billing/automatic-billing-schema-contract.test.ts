import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { membershipBillingTermsHash } from "./membership-billing-authorization";

const legacyMigration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/043_automatic_membership_billing.sql",
    import.meta.url,
  ),
  "utf8",
);
const currentMigration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/046_jobber_scheduled_service_billing.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration = `${legacyMigration}\n${currentMigration}`;

describe("automatic billing schema contract", () => {
  it("pins the approved billing disclosure hash in application and SQL", () => {
    const approvedHash =
      "ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd";
    expect(membershipBillingTermsHash()).toBe(approvedHash);
    expect(migration.match(new RegExp(approvedHash, "g"))?.length).toBeGreaterThanOrEqual(5);
  });
  it("installs global and per-member execution fail closed", () => {
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain(
      "automatic_billing_enabled boolean not null default false",
    );
    expect(migration).toMatch(
      /where not exists \([\s\S]*membership_billing_authorization_events authorization_event/,
    );
    expect(migration).toContain(
      "Authorization verified; founder must separately resume automatic billing",
    );
    expect(migration).toContain(
      "billing_automation_settings_enabled_truth_check",
    );
    expect(migration).toContain(
      "and stripe_webhook_secret_fingerprint ~ '^[0-9a-f]{64}$'",
    );
  });

  it("makes signed billing evidence complete, immutable, and idempotent", () => {
    expect(migration).toContain(
      "signed_agreements_billing_authorization_check",
    );
    expect(migration).toContain(
      "membership_billing_authorization_events_idempotency_unique",
    );
    expect(migration).toMatch(
      /on public\.membership_billing_authorization_events \(\s*membership_id,\s*agreement_id,\s*authorization_version,\s*evidence_source\s*\)/,
    );
    expect(migration).toMatch(
      /on conflict \(\s*membership_id,\s*agreement_id,\s*authorization_version,\s*evidence_source\s*\) do nothing/,
    );
    expect(migration).toContain(
      "Existing signed billing authorization cannot be rewritten",
    );
    expect(migration).toContain(
      "signed_agreements_billing_authorization_immutable",
    );
    expect(migration).toContain(
      "Signed billing authorization is immutable once recorded",
    );
    expect(migration).toContain(
      "membership_billing_authorization_events_immutable",
    );
  });

  it("allows multiple monthly services but only one active order per appointment", () => {
    expect(currentMigration).toContain(
      "drop index if exists public.billing_orders_active_membership_month_unique",
    );
    expect(currentMigration).toContain(
      "billing_orders_active_appointment_unique",
    );
    expect(currentMigration).toContain(
      "where preview_state <> 'void' and execution_state <> 'void'",
    );
  });

  it("requires an unbilled priced Jobber service at the paired property", () => {
    expect(currentMigration).not.toContain("join public.jobber_membership_job_links");
    expect(currentMigration).toContain("projection.is_complete = false");
    expect(currentMigration).toContain("projection.match_state = 'matched'");
    expect(currentMigration).toContain(
      "projection.matched_property_id = billing_order.property_id",
    );
    expect(currentMigration).toContain(
      "projection.job_total_cents = billing_order.expected_charge_cents",
    );
    expect(currentMigration).toContain("projection.job_will_auto_charge = false");
    expect(currentMigration).toContain("projection.visit_invoice_id is null");
    expect(currentMigration).toContain("property_link.link_state = 'active'");
  });

  it("claims due work, lease recovery, and its attempt row atomically", () => {
    expect(migration).toContain("create or replace function public.claim_due_billing_orders");
    expect(migration).toContain("for update of billing_order skip locked");
    expect(migration).toContain("lease_expires_at = p_now + interval '10 minutes'");
    expect(migration).toContain("billing_order.attempt_count + 1");
    expect(migration).toMatch(
      /attempts as \(\s*insert into public\.billing_attempts/,
    );
    expect(migration).toContain(
      "(p_now at time zone 'America/Los_Angeles')::date = p_service_month",
    );
    expect(migration).toContain("billing_order.stripe_customer_ready = true");
    expect(migration).toContain(
      "billing_order.stripe_payment_method_ready = true",
    );
    expect(migration).toContain("p_webhook_secret_fingerprint text");
    expect(migration).toContain(
      "settings.stripe_webhook_secret_fingerprint = p_webhook_secret_fingerprint",
    );
    expect(
      currentMigration.match(
        /billing_order\.execution_state = 'processing'\s+and billing_order\.stripe_payment_intent_id is not null\s+and billing_order\.lease_expires_at <= p_now/g,
      ),
    ).toHaveLength(2);
  });

  it("prepares founder retries with one locked row and one audit event", () => {
    expect(migration).toContain(
      "create or replace function public.prepare_founder_billing_retry",
    );
    expect(migration).toMatch(
      /order_record\.execution_state not in \(\s*'failed_retryable', 'needs_action', 'permanently_failed'\s*\)/,
    );
    const retryRpc = migration.match(
      /create or replace function public\.prepare_founder_billing_retry[\s\S]*?\n\$\$;/,
    )?.[0];
    expect(retryRpc).toBeDefined();
    expect(retryRpc).toContain("order_record.execution_state = 'needs_action'");
    expect(retryRpc).toContain("'authentication_required'");
    expect(retryRpc).toContain(
      "Customer authentication is required; founder retry is not allowed",
    );
    expect(migration).toContain("'month', p_now at time zone 'America/Los_Angeles'");
    expect(migration).toContain(
      "Founder explicitly approved retry for the current service month",
    );
  });

  it("finalizes order, attempt, and charge state in database transactions", () => {
    expect(migration).toContain(
      "create or replace function public.finalize_billing_attempt_success",
    );
    expect(migration).toContain(
      "create or replace function public.finalize_billing_attempt_failure",
    );
    expect(migration).toContain("Billing attempt ledger row not found");
    expect(migration).toContain(
      "A succeeded billing attempt cannot be downgraded",
    );
    expect(migration).toContain(
      "Non-retryable outcomes cannot schedule a hidden retry",
    );
    expect(migration).toContain(
      "Existing manual paid ledger cannot be rebound to a PaymentIntent",
    );
    expect(migration).toContain("billing_authority_verified_at");
    expect(migration).toContain("billing_authority_verified_by");
    expect(migration).toContain(
      "Historical paid ledger requires post-hardening founder verification",
    );
    expect(migration).toContain("stripe_verified_billing_automation");
  });

  it("reclaims failed or stale Stripe deliveries without accepting identity drift", () => {
    expect(migration).toContain(
      "create or replace function public.claim_stripe_event",
    );
    expect(migration).toContain("processing_attempt_count = processing_attempt_count + 1");
    expect(migration).toContain(
      "ledger_record.api_version is distinct from p_api_version",
    );
    expect(migration).toContain(
      "ledger_record.object_id is distinct from p_object_id",
    );
  });

  it("keeps billing control, attempts, evidence, and charges private", () => {
    for (const table of [
      "billing_automation_settings",
      "billing_automation_runs",
      "billing_attempts",
      "membership_billing_authorization_events",
      "jobber_membership_job_links",
      "jobber_membership_job_link_events",
      "membership_billing_charges",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
    }
    expect(migration).not.toMatch(
      /create policy[\s\S]{0,160}(billing_automation|billing_attempts|membership_billing_authorization_events)/i,
    );
  });

  it("removes legacy public mutation access from billing source truth", () => {
    expect(migration).toContain("from pg_policies");
    for (const table of [
      "member_appointments",
      "obligations",
      "obligation_events",
      "atlas_pricing_snapshots",
      "appointment_source_events",
      "jobber_visit_projections",
      "jobber_property_links",
    ]) {
      expect(migration).toContain(`'${table}'`);
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
    }
  });

  it("limits every billing mutation RPC to the service role", () => {
    for (const rpc of [
      "attest_membership_billing_authorization",
      "claim_stripe_event",
      "prepare_founder_billing_retry",
      "claim_due_billing_orders",
      "finalize_billing_attempt_success",
      "finalize_billing_attempt_failure",
    ]) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]{0,180}\\) to service_role`),
      );
    }
  });
});
