import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/054_visit_field_records.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("visit field record database contract", () => {
  it("keeps phone photos in a private, bounded storage bucket", () => {
    expect(migration).toContain("'homeatlas-visit-media'");
    expect(migration).toContain("false,");
    expect(migration).toContain("15728640");
    expect(migration).toContain("allowed_mime_types");
    expect(migration).not.toContain("to anon");
    expect(migration).not.toContain("to authenticated");
  });

  it("commits one replay-safe assessment and its photo metadata atomically", () => {
    expect(migration).toContain("property_assessments_field_record_uidx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "Field record ID does not belong to this visit",
    );
    expect(migration).toContain("create or replace function public.commit_visit_field_record");
    expect(migration).toContain("join public.member_appointments appointment");
    expect(migration).toContain("Appointment does not belong to the HomeAtlas property");
    expect(migration).toContain("insert into public.property_assessments");
    expect(migration).toContain("insert into public.property_assets");
  });

  it("exposes the commit function only to the service role", () => {
    expect(migration).toContain(
      "revoke all on function public.commit_visit_field_record",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
  });

  it("closes browser access to private field-intelligence tables", () => {
    for (const table of [
      "member_profiles",
      "member_savings_transactions",
      "service_observations",
      "ai_quotes",
      "property_assessments",
      "property_visit_health_checks",
    ]) {
      expect(migration).toContain(
        `revoke all privileges on table public.${table}`,
      );
      expect(migration).toContain(`grant select, insert, update, delete on table public.${table}`);
    }
  });
});
