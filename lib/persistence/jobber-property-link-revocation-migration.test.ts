import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/041_jobber_property_link_revocation.sql",
    import.meta.url,
  ),
  "utf8",
);
const functionalRehearsal = readFileSync(
  new URL("./supabase/tests/039_jobber_visit_classification.sql", import.meta.url),
  "utf8",
);
const catalogRehearsal = readFileSync(
  new URL("./supabase/tests/041_jobber_property_link_revocation.sql", import.meta.url),
  "utf8",
);
const rpc = migration.match(
  /create or replace function public\.revoke_jobber_property_link[\s\S]*?\n\$\$;/,
)?.[0] ?? "";

function expectOrdered(source: string, fragments: readonly string[]) {
  let previous = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, previous + 1);
    expect(next, `missing ordered SQL fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("migration 041 Jobber property-link revocation", () => {
  it("keeps the atomic RPC service-role only", () => {
    expect(rpc).toContain("security definer");
    expect(rpc).toContain("set search_path = pg_catalog");
    expect(migration).toMatch(
      /revoke all on function public\.revoke_jobber_property_link\([\s\S]*?\) from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.revoke_jobber_property_link\([\s\S]*?\) to service_role;/,
    );
  });

  it("matches approval lock order and revalidates exact identities and version", () => {
    expectOrdered(rpc, [
      "from public.hq_admin_users actor",
      "from public.jobber_connections connection",
      "from public.jobber_schedule_sync_locks sync_lock",
      "from public.jobber_visit_projections projection",
      "from public.jobber_property_links property_link",
    ]);
    for (const fragment of [
      "actor.active = true",
      "actor.role in ('owner', 'operator')",
      "projection_row.connection_id <> connection_row.id",
      "link_row.connection_id <> connection_row.id",
      "link_row.external_property_id <> projection_row.external_property_id",
      "link_row.updated_at <> requested_expected_link_updated_at",
      "revocation_projection_id = requested_projection_id",
      "revocation_expected_link_updated_at = requested_expected_link_updated_at",
    ]) expect(rpc).toContain(fragment);
  });

  it("accepts only an exact immutable replay and relies on one trigger event", () => {
    expect(rpc).toContain("Revocation replay did not match");
    expect(rpc).toContain("from public.jobber_property_link_events event");
    expect(rpc).not.toContain("insert into public.jobber_property_link_events");
    expect(migration.match(/insert into public\.jobber_property_link_events/g)).toHaveLength(1);
  });

  it("demotes approved derived authority without deletes or double demotion", () => {
    expect(migration).toContain("classification_state = 'pending_review'");
    expect(migration).toContain("jobber_authority_state = 'pending_review'");
    expect(migration).toContain("'property_link_invalidated'");
    expect(migration).not.toMatch(/delete\s+from/i);
    expect(rpc).not.toContain("invalidate_jobber_visit_authority_for_property_link(");
  });

  it("writes no obligation, pricing, billing, Stripe, membership, agreement, or Property Memory state", () => {
    for (const table of [
      "obligations", "atlas_pricing_snapshots", "billing_orders",
      "membership_billing_charges", "memberships", "signed_agreements",
      "property_assets", "service_observations",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`, "i"),
      );
    }
    expect(migration).not.toMatch(/stripe\s*\./i);
  });

  it("ships seeded functional replay, failure, demotion, ledger, ACL, and forbidden-domain assertions", () => {
    for (const fragment of [
      "result := public.revoke_jobber_property_link(",
      "Migration 041 exact replay did not converge",
      "Migration 041 stale revocation version was accepted",
      "Migration 041 different projection replay was accepted",
      "Migration 041 different reason replay was accepted",
      "Migration 041 missing reviewed link identity was accepted",
      "invalidation_events_before + approved_before",
      "Migration 041 did not revoke and demote authority exactly once without deletes",
      "Migration 041 changed forbidden money, obligation, or Property Memory state",
      "rollback_migration_041_functional_rehearsal",
    ]) expect(functionalRehearsal).toContain(fragment);
    expect(catalogRehearsal).toContain(
      "Migration 041 revocation RPC ACL is not exact",
    );
    expect(catalogRehearsal).toContain("function_acl.grantee not in");
  });
});
