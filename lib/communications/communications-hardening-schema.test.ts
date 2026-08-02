import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/045_communications_consent_and_provider_readiness.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

describe("communications hardening migration", () => {
  it("keeps SMS automation off until the owner deliberately enables it", () => {
    expect(migration).toContain("set enabled = false");
    expect(migration).toContain("where channel = 'sms'");
  });

  it("stores immutable, idempotent HQ consent evidence", () => {
    expect(migration).toContain("customer_contact_consent_events");
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("explicit customer consent attestation is required");
    expect(migration).toContain("customer contact consent evidence is append-only");
    expect(migration).toContain("record_hq_sms_consent_decision");
  });

  it("stores signed provider proof without exposing it to public roles", () => {
    expect(migration).toContain(
      "customer_communication_provider_verifications",
    );
    expect(migration).toContain("webhook_secret_fingerprint");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
  });
});
