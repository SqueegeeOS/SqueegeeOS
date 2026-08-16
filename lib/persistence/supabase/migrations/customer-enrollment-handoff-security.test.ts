import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./066_customer_enrollment_handoff.sql");
const audit = read("../../../../scripts/audit-migrations.mjs");
const securityVerification = read(
  "../../../../scripts/verify-supabase-security.mjs",
);

describe("migration 066 enrollment evidence and privacy", () => {
  it("is transactional and seeds legal drafts without approving them", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trim().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration).toContain("'master_service_agreement'");
    expect(migration).toContain("'service_quote_agreement'");
    expect(migration).toContain("'attorney_review'");
    expect(migration).not.toMatch(
      /insert into public\.agreement_document_versions[\s\S]+?'approved'/i,
    );
  });

  it("keeps enrollment records private and the event ledger immutable", () => {
    for (const table of [
      "agreement_document_versions",
      "enrollment_packets",
      "enrollment_packet_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(`public.${table}`);
      expect(audit).toContain(`hasTable(s, "${table}")`);
      expect(securityVerification).toContain(`"${table}"`);
    }
    expect(migration).toContain("enrollment_packet_events_immutable");
    expect(migration).toContain("reject_immutable_ledger_change");
    expect(migration).toContain(
      "revoke all privileges on table public.enrollment_packets",
    );
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("deduplicates provider evidence and distinguishes the two prices", () => {
    expect(migration).toContain("first_visit_price_cents integer not null");
    expect(migration).toContain("recurring_visit_price_cents integer not null");
    expect(migration).toContain("enrollment_packets_docusign_envelope_uidx");
    expect(migration).toContain("enrollment_packets_stripe_session_uidx");
    expect(migration).toContain("enrollment_packets_stripe_setup_intent_uidx");
    expect(migration).toContain("enrollment_packet_events_provider_key_uidx");
    expect(migration).toContain("signed_agreements_external_envelope_uidx");
    expect(migration).toContain("membership_cancellation");
    expect(audit).toContain(
      'constraintIncludes(s, "customer_service_cases", "membership_cancellation")',
    );
    expect(audit).toContain('["066", "customer enrollment handoff"');
  });
});
