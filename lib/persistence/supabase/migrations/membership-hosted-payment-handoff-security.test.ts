import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./068_membership_hosted_payment_handoff.sql");

describe("migration 068 hosted membership payment handoff", () => {
  it("is transactional and adds a distinct payment setup email ledger type", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trim().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration).toContain("'payment_setup_email'");
  });

  it("binds the handoff to the signed customer graph and Stripe evidence", () => {
    for (const column of [
      "membership_id uuid not null unique",
      "presentation_id uuid not null",
      "agreement_id uuid not null",
      "homeowner_id uuid not null",
      "property_id uuid not null",
      "billing_terms_hash text not null",
      "stripe_checkout_session_id text",
      "stripe_setup_intent_id text",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("membership_payment_handoffs_session_uidx");
    expect(migration).toContain("membership_payment_handoffs_setup_intent_uidx");
  });

  it("keeps URLs and events private while preserving an immutable audit trail", () => {
    for (const table of [
      "membership_payment_handoffs",
      "membership_payment_handoff_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("membership_payment_handoff_events_immutable");
    expect(migration).toContain("reject_immutable_ledger_change");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
