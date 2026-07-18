import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./supabase/migrations/040_jobber_member_property_search_link.sql",
    import.meta.url,
  ),
  "utf8",
);
const basePropertyLinkMigration = readFileSync(
  new URL(
    "./supabase/migrations/034_jobber_supervised_property_links.sql",
    import.meta.url,
  ),
  "utf8",
);
const classificationMigration = readFileSync(
  new URL(
    "./supabase/migrations/039_jobber_visit_classification.sql",
    import.meta.url,
  ),
  "utf8",
);
const linkRpc =
  migration.match(
    /create or replace function public\.link_jobber_member_property_from_search[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
const classificationRpc =
  classificationMigration.match(
    /create or replace function public\.decide_jobber_visit_classification[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

function expectOrdered(source: string, fragments: readonly string[]) {
  let previousIndex = -1;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment, previousIndex + 1);
    expect(index, `missing ordered SQL fragment: ${fragment}`).toBeGreaterThan(
      previousIndex,
    );
    previousIndex = index;
  }
}

describe("migration 040 Jobber member-property search link", () => {
  it("keeps the security-definer RPC service-role only", () => {
    expect(linkRpc).toContain("security definer");
    expect(linkRpc).toContain("set search_path = pg_catalog");
    expect(migration).toMatch(
      /revoke all on function public\.link_jobber_member_property_from_search\([\s\S]*?\) from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.link_jobber_member_property_from_search\([\s\S]*?\) to service_role;/,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.link_jobber_member_property_from_search\([\s\S]*?\) to (?:public|anon|authenticated);/,
    );
  });

  it("locks and revalidates the active actor and exact signed membership property", () => {
    for (const fragment of [
      "actor.user_id = requested_actor_id",
      "actor_row.active is distinct from true",
      "membership.id = requested_membership_id",
      "membership_row.status <> 'active'",
      "property.id = membership_row.property_id",
      "property.homeowner_id = membership_row.homeowner_id",
      "agreement.id = membership_row.agreement_id",
      "agreement.status = 'complete'",
      "agreement.membership_id = membership_row.id",
      "agreement.property_id = property_row.id",
      "agreement.homeowner_id = property_row.homeowner_id",
    ]) {
      expect(linkRpc).toContain(fragment);
    }
  });

  it("matches migration 039's property-link-before-membership lock order", () => {
    expectOrdered(classificationRpc, [
      "select * into link_row",
      "select * into membership_row",
    ]);
    expectOrdered(linkRpc, [
      "from public.hq_admin_users actor",
      "from public.jobber_connections connection",
      "'jobber_property_link:external:'",
      "select * into existing_link",
      "select membership.property_id into requested_property_id",
      "'jobber_property_link:property:'",
      "select * into property_conflict",
      "select * into membership_row",
      "from public.properties property",
      "from public.signed_agreements agreement",
    ]);
    expect(linkRpc).toMatch(
      /from public\.jobber_connections connection[\s\S]*?for update;/,
    );
    expect(linkRpc).toMatch(
      /select \* into existing_link[\s\S]*?for update;[\s\S]*?select \* into property_conflict[\s\S]*?for update;[\s\S]*?select \* into membership_row[\s\S]*?for update;/,
    );
  });

  it("stores complete provider ownership evidence on link and event rows", () => {
    for (const column of [
      "jobber_client_id",
      "jobber_property_web_uri",
      "observed_graphql_version",
      "ownership_observed_at",
      "ownership_pages_scanned",
      "property_coverage_complete",
    ]) {
      expect(
        migration.match(
          new RegExp(`add column if not exists ${column}`, "g"),
        ),
      ).toHaveLength(2);
      expect(migration).toMatch(
        new RegExp(`new\\.${column}`),
      );
    }
    expect(linkRpc).toContain(
      "requested_property_coverage_complete is distinct from true",
    );
    expect(linkRpc).toContain(
      "requested_ownership_pages_scanned not between 1 and 10",
    );
    expect(migration).toContain(
      "alter table public.jobber_property_links enable row level security",
    );
    expect(migration).toContain(
      "alter table public.jobber_property_link_events enable row level security",
    );
  });

  it("serializes identities and converges only exact replays to already_linked", () => {
    expect(basePropertyLinkMigration).toContain(
      "unique (connection_id, external_property_id)",
    );
    expect(basePropertyLinkMigration).toContain(
      "jobber_property_links_active_property_unique",
    );
    expect(linkRpc.match(/insert into public\.jobber_property_links/g)).toHaveLength(
      1,
    );
    expect(linkRpc).toMatch(
      /existing_link\.link_state = 'active'[\s\S]*?existing_link\.membership_id = membership_row\.id[\s\S]*?existing_link\.property_id = property_row\.id[\s\S]*?update public\.jobber_property_links[\s\S]*?insert into public\.jobber_property_link_events[\s\S]*?'ownership_verified'[\s\S]*?'outcome', 'already_linked'[\s\S]*?Jobber property already has a different active link/,
    );
    expect(linkRpc).toContain(
      "HomeAtlas property already has a different active Jobber link",
    );
    expect(linkRpc).not.toContain("when unique_violation");
  });

  it("refreshes legacy link evidence and appends immutable ownership verification", () => {
    expect(migration).toMatch(
      /drop constraint if exists jobber_property_link_events_event_type_check,[\s\S]*?event_type in \('linked', 'relinked', 'revoked', 'ownership_verified'\)/,
    );
    expect(basePropertyLinkMigration).toMatch(
      /jobber_property_link_events_immutable[\s\S]*?before update or delete on public\.jobber_property_link_events/,
    );
    for (const assignment of [
      "jobber_client_id = requested_jobber_client_id",
      "jobber_property_web_uri = requested_jobber_property_web_uri",
      "observed_graphql_version = pg_catalog.btrim(requested_graphql_version)",
      "ownership_observed_at = requested_ownership_observed_at",
      "ownership_pages_scanned = requested_ownership_pages_scanned",
      "property_coverage_complete = true",
    ]) {
      expect(linkRpc).toContain(assignment);
    }
    expect(linkRpc).toMatch(
      /update public\.jobber_property_links[\s\S]*?where id = existing_link\.id[\s\S]*?returning \* into linked_row;[\s\S]*?insert into public\.jobber_property_link_events/,
    );
    expect(linkRpc).toMatch(
      /existing_link\.ownership_observed_at is null[\s\S]*?requested_ownership_observed_at >= existing_link\.ownership_observed_at[\s\S]*?update public\.jobber_property_links[\s\S]*?else[\s\S]*?linked_row := existing_link;[\s\S]*?end if;[\s\S]*?insert into public\.jobber_property_link_events/,
    );
    expect(linkRpc).toMatch(
      /linked_row\.id, 'ownership_verified',[\s\S]*?requested_actor_id::text,[\s\S]*?requested_jobber_client_id, requested_jobber_property_web_uri,[\s\S]*?requested_ownership_observed_at, requested_ownership_pages_scanned,[\s\S]*?true, changed_at/,
    );
    expect(linkRpc).not.toMatch(
      /where id = existing_link\.id[\s\S]{0,400}ownership_observed_at is not null/,
    );
  });

  it("does not reference or write scheduling, obligation, pricing, billing, Stripe, or Property Memory domains", () => {
    for (const forbidden of [
      /appointments?/i,
      /obligations?/i,
      /pricing/i,
      /billing/i,
      /stripe/i,
      /property[_\s-]?memory/i,
    ]) {
      expect(migration).not.toMatch(forbidden);
    }
  });
});
