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

  it("revokes all browser reads and mutations on customer authority tables", () => {
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
    expect(migration).not.toContain("home_care_plans_anon_read");
    expect(migration).toMatch(
      /revoke select on table public\.home_care_plans\s+from public, anon, authenticated/,
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

  it("makes completed agreements immutable without blocking finalization or incomplete rows", () => {
    expect(migration).toMatch(
      /create or replace function public\.reject_completed_signed_agreement_mutation\(\)[\s\S]*?set search_path = pg_catalog[\s\S]*?if old\.status = 'complete' then[\s\S]*?Completed signed agreements are immutable/,
    );
    expect(migration).toMatch(
      /create trigger signed_agreements_complete_immutable\s+before update or delete on public\.signed_agreements\s+for each row execute function public\.reject_completed_signed_agreement_mutation\(\)/,
    );
    expect(migration).not.toMatch(
      /signed_agreements_complete_immutable\s+before insert/i,
    );
    expect(migration).toMatch(
      /if tg_op = 'DELETE' then\s+return old;\s+end if;\s+return new;/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.reject_completed_signed_agreement_mutation\(\)\s+from public, anon, authenticated, service_role;\s+grant execute on function public\.reject_completed_signed_agreement_mutation\(\)\s+to service_role;/,
    );
    expect(migration).toMatch(
      /finalize_presentation_signing_attempt[\s\S]*?insert into public\.signed_agreements[\s\S]*?'complete'/,
    );

    const schema = read("./supabase/schema.sql");
    expect(schema).toContain("signed_agreements_complete_immutable");
    expect(schema).toContain("reject_completed_signed_agreement_mutation");
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
    expect(audit).toContain("signedAgreementImmutabilityFunctionExact");
    expect(audit).toContain("signedAgreementImmutabilityTriggerExact");
  });

  it("ships real anon/authenticated concurrency and fault rehearsal hooks", () => {
    const harness = read("./supabase/authority-closure.integration.test.ts");
    expect(harness).toContain("PR1B_TEST_SUPABASE_ANON_KEY");
    expect(harness).toContain("signInWithPassword");
    expect(harness).toContain("Promise.all");
    expect(harness).toContain("PR1B_TEST_SIGNING_FAULT_STAGE");
    expect(harness).toContain("conflictingSignature");
    expect(harness).toContain('from("presentations")');
    expect(harness).toContain('select("id, homeowner_slug")');
    expect(harness).toContain("Denied service-role mutation");
    expect(harness).toContain("Updated incomplete workflow");
  });

  it("requires the plan UUID on cloud routes and keeps slug-only reads local", () => {
    const slugPage = read(
      "../../app/homecare/[homeownerSlug]/[propertySlug]/plan/page.tsx",
    );
    const capabilityPage = read(
      "../../app/homecare/[homeownerSlug]/[propertySlug]/plan/[planId]/page.tsx",
    );
    const client = read(
      "../../app/homecare/[homeownerSlug]/[propertySlug]/plan/generated-home-care-plan-client.tsx",
    );
    const wizard = read(
      "../../components/home-care-plan/create/create-home-care-plan-wizard.tsx",
    );
    expect(slugPage).not.toContain("loadHomeCarePlanPresentation");
    expect(slugPage).toContain("allowLocalFallback={!cloudPersistenceConnected}");
    expect(capabilityPage).toContain(
      "loadHomeCarePlanPresentationByCapability",
    );
    expect(capabilityPage).toContain("planId");
    expect(wizard).toContain("outcome.record.presentation");
    expect(wizard).toContain("outcome.record.id");
    expect(client).not.toContain("supabaseAdapter");
    expect(client).not.toContain("createBrowserSupabaseClient");
  });

  it("keeps legacy slug portal and health routes off privileged cloud reads", () => {
    const slugPortalLoader = read("../membership/load-member-portal-page.ts");
    const slugHealthPage = read(
      "../../app/homecare/[homeownerSlug]/[propertySlug]/portal/home-health/page.tsx",
    );
    expect(slugPortalLoader).toMatch(
      /loadMemberPortalPageBySlugs[\s\S]*?return null;/,
    );
    expect(slugHealthPage).not.toContain("getPropertyIdBySlugs");
    expect(slugHealthPage).not.toContain("listStaffAssessments");
    expect(slugHealthPage).not.toContain("listStaffHealthChecks");
  });

  it("binds token health reads to the token-resolved property ID", () => {
    const tokenHealthPage = read(
      "../../app/portal/[token]/home-health/page.tsx",
    );
    expect(tokenHealthPage).not.toContain("getPropertyIdBySlugs");
    expect(tokenHealthPage).toContain("listStaffAssessments(model.propertyId)");
    expect(tokenHealthPage).toContain("listStaffHealthChecks(model.propertyId)");
  });
});

describe("browser Supabase adapter", () => {
  it("has no callable Home Care Plan read or mutation authority", async () => {
    const blocked = /Browser Supabase mutation authority is closed/;
    const readBlocked = /Browser Supabase Home Care Plan reads are closed/;
    await expect(
      supabaseAdapter.getHomeCarePlanBySlugs("homeowner", "property"),
    ).rejects.toThrow(readBlocked);
    await expect(supabaseAdapter.listHomeCarePlans()).rejects.toThrow(readBlocked);
    await expect(supabaseAdapter.saveHomeCarePlan({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.upsertHomeowner({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.upsertProperty({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.saveMembership({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.saveSignedAgreement({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.savePhotoDocument({} as never)).rejects.toThrow(blocked);
    await expect(supabaseAdapter.deleteHomeCarePlan("a", "b")).rejects.toThrow(blocked);
  });
});
