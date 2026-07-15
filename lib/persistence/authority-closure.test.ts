import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { supabaseAdapter } from "./adapters/supabase";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("migration 036 authority closure", () => {
  const migration = read(
    "./supabase/migrations/036_hq_authority_input_closure.sql",
  );

  it("revokes all browser mutations and leaves only the required plan read", () => {
    for (const table of [
      "homeowners",
      "properties",
      "home_care_plans",
      "memberships",
      "signed_agreements",
      "property_assets",
      "presentations",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toContain("create policy");
    expect(migration).toContain("and cmd = 'SELECT'");
    expect(migration).toContain(
      "and policyname = 'home_care_plans_anon_read'",
    );
  });

  it("makes presentation capabilities non-enumerable and signing idempotent", () => {
    expect(migration).toContain("'presentations'");
    expect(migration).toContain("and cmd = 'SELECT'");
    expect(migration).toContain(
      "create unique index signed_agreements_complete_presentation_uidx",
    );
    expect(migration).toContain("duplicate completed presentation agreements require review");
    expect(migration).toContain("presentation_signing_attempts");
    expect(migration).toContain("claim_presentation_signing_attempt");
    expect(migration).toContain("finalize_presentation_signing_attempt");
    expect(migration).toContain("storage_backend");
    expect(migration).toContain("'supabase'");
    expect(migration).toContain("conflicting tier or signature evidence");
    expect(migration).toContain("authority_address_key");
    expect(migration).toContain("properties_authority_address_uidx");
    expect(migration).toContain(
      "Cannot enforce normalized property identity: address variants require review",
    );
  });

  it("ships a service-role-only atomic plan-authoring function", () => {
    expect(migration).toContain(
      "create or replace function public.save_hq_home_care_plan",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain("to service_role");
    expect(migration).toMatch(/insert into public\.homeowners[\s\S]*insert into public\.properties[\s\S]*insert into public\.home_care_plans/);
    const rehearsal = read(
      "./supabase/tests/036_home_care_plan_atomicity.sql",
    );
    expect(rehearsal).toContain("injected PR1b plan failure");
    expect(rehearsal).toContain(
      "Homeowner/property state survived an atomic plan failure",
    );
    expect(rehearsal).toContain("Home Care Plan retry created duplicate records");
    expect(rehearsal).toMatch(/begin;[\s\S]*rollback;/i);
  });

  it("revokes browser RPC execute and defines exact authority audit inputs", () => {
    for (const functionName of [
      "save_hq_home_care_plan",
      "claim_presentation_signing_attempt",
      "finalize_presentation_signing_attempt",
    ]) {
      expect(migration).toContain(`function public.${functionName}`);
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated`,
        ),
      );
    }
    const audit = read("../../scripts/audit-migrations.mjs");
    expect(audit).toContain("authorityAclExact");
    expect(audit).toContain("authorityFunctionAclExact");
    expect(audit).toContain("signingIdempotencyIndexExact");
  });

  it("ships real anon/authenticated concurrency and fault rehearsal hooks", () => {
    const harness = read("./supabase/authority-closure.integration.test.ts");
    expect(harness).toContain("PR1B_TEST_SUPABASE_ANON_KEY");
    expect(harness).toContain("signInWithPassword");
    expect(harness).toContain("Promise.all");
    expect(harness).toContain("PR1B_TEST_SIGNING_FAULT_STAGE");
    expect(harness).toContain("conflictingSignature");
    expect(harness).toContain('from("presentations")');
  });
});

describe("browser Supabase adapter", () => {
  it("has no callable mutation authority", async () => {
    const blocked = /Browser Supabase mutation authority is closed/;
    await expect(supabaseAdapter.saveHomeCarePlan({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.upsertHomeowner({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.upsertProperty({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.saveMembership({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.saveSignedAgreement({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.savePhotoDocument({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.deleteHomeCarePlan("a", "b")).rejects.toThrow(blocked);
  });
});
