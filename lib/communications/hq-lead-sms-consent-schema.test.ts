import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/20260823032837_hq_lead_sms_consent.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\s+/g, " ");

const service = readFileSync(
  new URL("./hq-sms-consent.ts", import.meta.url),
  "utf8",
);

describe("HQ lead SMS consent", () => {
  it("stores exact-number verification and append-only consent evidence", () => {
    expect(migration).toContain(
      "add column if not exists sms_verified_at timestamptz",
    );
    expect(migration).toContain(
      "create table if not exists public.lead_sms_consent_events",
    );
    expect(migration).toContain(
      "create trigger lead_sms_consent_events_immutable before update or delete",
    );
    expect(migration).toContain(
      "create or replace function public.record_hq_lead_sms_consent_decision",
    );
    expect(migration).toContain(
      "lead.sms_verified_at is null then 'unverified' else 'verified'",
    );
  });

  it("keeps the lead decision private and service-role only", () => {
    expect(migration).toContain(
      "alter table public.lead_sms_consent_events enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.lead_sms_consent_events from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.record_hq_lead_sms_consent_decision",
    );
    expect(service).toContain('"record_hq_lead_sms_consent_decision"');
    expect(service).toContain("lead_consent_confirmation_failed");
  });
});
