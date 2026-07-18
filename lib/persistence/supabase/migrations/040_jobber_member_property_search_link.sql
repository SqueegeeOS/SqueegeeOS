-- Atomic supervised Jobber client-property to HomeAtlas member-property link.
-- Provider ownership evidence is retained without tokens or customer search text.

alter table public.jobber_property_links
  add column if not exists jobber_client_id text,
  add column if not exists jobber_property_web_uri text,
  add column if not exists observed_graphql_version text,
  add column if not exists ownership_observed_at timestamptz,
  add column if not exists ownership_pages_scanned integer,
  add column if not exists property_coverage_complete boolean;

alter table public.jobber_property_link_events
  add column if not exists jobber_client_id text,
  add column if not exists jobber_property_web_uri text,
  add column if not exists observed_graphql_version text,
  add column if not exists ownership_observed_at timestamptz,
  add column if not exists ownership_pages_scanned integer,
  add column if not exists property_coverage_complete boolean;

-- Migration 034's inline check receives the deterministic PostgreSQL name.
-- Replace it with a strict superset so ownership refreshes can be recorded
-- without weakening the existing immutable event ledger.
alter table public.jobber_property_link_events
  drop constraint if exists jobber_property_link_events_event_type_check,
  add constraint jobber_property_link_events_event_type_check check (
    event_type in ('linked', 'relinked', 'revoked', 'ownership_verified')
  );

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'jobber_property_links_ownership_evidence_check'
  ) then
    alter table public.jobber_property_links
      add constraint jobber_property_links_ownership_evidence_check check (
        (
          jobber_client_id is null
          and jobber_property_web_uri is null
          and observed_graphql_version is null
          and ownership_observed_at is null
          and ownership_pages_scanned is null
          and property_coverage_complete is null
        )
        or
        (
          nullif(pg_catalog.btrim(jobber_client_id), '') is not null
          and nullif(pg_catalog.btrim(jobber_property_web_uri), '') is not null
          and jobber_property_web_uri ~ '^https://'
          and nullif(pg_catalog.btrim(observed_graphql_version), '') is not null
          and ownership_observed_at is not null
          and ownership_pages_scanned between 1 and 10
          and property_coverage_complete is true
        )
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'jobber_property_link_events_ownership_evidence_check'
  ) then
    alter table public.jobber_property_link_events
      add constraint jobber_property_link_events_ownership_evidence_check check (
        (
          jobber_client_id is null
          and jobber_property_web_uri is null
          and observed_graphql_version is null
          and ownership_observed_at is null
          and ownership_pages_scanned is null
          and property_coverage_complete is null
        )
        or
        (
          nullif(pg_catalog.btrim(jobber_client_id), '') is not null
          and nullif(pg_catalog.btrim(jobber_property_web_uri), '') is not null
          and jobber_property_web_uri ~ '^https://'
          and nullif(pg_catalog.btrim(observed_graphql_version), '') is not null
          and ownership_observed_at is not null
          and ownership_pages_scanned between 1 and 10
          and property_coverage_complete is true
        )
      );
  end if;
end;
$$;

create or replace function public.audit_jobber_property_link_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  next_event_type text;
  event_actor text;
  event_reason text;
begin
  if tg_op = 'INSERT' then
    next_event_type := 'linked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  elsif old.link_state = 'active' and new.link_state = 'revoked' then
    next_event_type := 'revoked';
    event_actor := new.revoked_by;
    event_reason := new.revoke_reason;
  elsif old.link_state = 'revoked' and new.link_state = 'active' then
    next_event_type := 'relinked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  else
    return new;
  end if;

  insert into public.jobber_property_link_events (
    link_id, event_type, external_property_id, previous_property_id,
    property_id, previous_membership_id, membership_id, actor, reason,
    jobber_client_id, jobber_property_web_uri, observed_graphql_version,
    ownership_observed_at, ownership_pages_scanned,
    property_coverage_complete
  ) values (
    new.id, next_event_type, new.external_property_id,
    case when tg_op = 'UPDATE' then old.property_id else null end,
    new.property_id,
    case when tg_op = 'UPDATE' then old.membership_id else null end,
    new.membership_id, event_actor, event_reason, new.jobber_client_id,
    new.jobber_property_web_uri, new.observed_graphql_version,
    new.ownership_observed_at, new.ownership_pages_scanned,
    new.property_coverage_complete
  );

  return new;
end;
$$;

create or replace function public.link_jobber_member_property_from_search(
  requested_actor_id uuid,
  requested_connection_id text,
  requested_jobber_client_id text,
  requested_external_property_id text,
  requested_jobber_property_web_uri text,
  requested_graphql_version text,
  requested_ownership_observed_at timestamptz,
  requested_ownership_pages_scanned integer,
  requested_property_coverage_complete boolean,
  requested_membership_id uuid,
  requested_same_physical_property_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  actor_row public.hq_admin_users%rowtype;
  connection_row public.jobber_connections%rowtype;
  requested_property_id uuid;
  membership_row public.memberships%rowtype;
  property_row public.properties%rowtype;
  agreement_row public.signed_agreements%rowtype;
  existing_link public.jobber_property_links%rowtype;
  property_conflict public.jobber_property_links%rowtype;
  linked_row public.jobber_property_links%rowtype;
begin
  if requested_actor_id is null
    or requested_connection_id is null
    or nullif(pg_catalog.btrim(requested_connection_id), '') is null
    or requested_jobber_client_id is null
    or nullif(pg_catalog.btrim(requested_jobber_client_id), '') is null
    or requested_external_property_id is null
    or nullif(pg_catalog.btrim(requested_external_property_id), '') is null
    or requested_jobber_property_web_uri is null
    or requested_jobber_property_web_uri !~ '^https://'
    or requested_graphql_version is null
    or nullif(pg_catalog.btrim(requested_graphql_version), '') is null
    or requested_ownership_observed_at is null
    or requested_ownership_observed_at > changed_at
    or requested_ownership_pages_scanned is null
    or requested_ownership_pages_scanned not between 1 and 10
    or requested_property_coverage_complete is distinct from true
    or requested_membership_id is null
    or requested_same_physical_property_confirmed is distinct from true
  then
    raise exception 'jobber_link_invalid: complete supervised ownership evidence is required';
  end if;

  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
  for update;
  if not found or actor_row.active is distinct from true then
    raise exception 'jobber_link_forbidden: Headquarters actor is not active';
  end if;

  select * into connection_row
  from public.jobber_connections connection
  where connection.id = requested_connection_id
  for update;
  if not found
    or connection_row.status <> 'connected'
    or connection_row.graphql_version <> pg_catalog.btrim(requested_graphql_version)
  then
    raise exception 'jobber_link_conflict: Jobber connection or API version changed';
  end if;

  -- Match migration 039's shared-resource order: property link before
  -- membership. The connection row serializes migration-040 calls for this
  -- connection; the external advisory lock also fences the exact Jobber
  -- identity before its row is selected or inserted.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jobber_property_link:external:' || requested_connection_id || ':' || requested_external_property_id,
      0
    )
  );

  select * into existing_link
  from public.jobber_property_links link
  where link.connection_id = requested_connection_id
    and link.external_property_id = requested_external_property_id
  for update;

  -- Read only the candidate property key before taking its advisory/link lock.
  -- The membership row is locked and this key is revalidated below.
  select membership.property_id into requested_property_id
  from public.memberships membership
  where membership.id = requested_membership_id;
  if not found then
    raise exception 'jobber_link_not_found: Membership was not found';
  end if;

  -- Every migration-040 caller takes the external identity before this
  -- HomeAtlas-property identity. Both possibly conflicting property-link rows
  -- are locked before membership, matching migration 039's shared order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jobber_property_link:property:' || requested_connection_id || ':' || requested_property_id::text,
      0
    )
  );

  select * into property_conflict
  from public.jobber_property_links link
  where link.connection_id = requested_connection_id
    and link.property_id = requested_property_id
    and link.link_state = 'active'
    and (existing_link.id is null or link.id <> existing_link.id)
  for update;

  select * into membership_row
  from public.memberships membership
  where membership.id = requested_membership_id
    and membership.property_id = requested_property_id
  for update;
  if not found then
    raise exception 'jobber_link_conflict: Membership property changed during review';
  end if;

  select * into property_row
  from public.properties property
  where property.id = membership_row.property_id
    and property.homeowner_id = membership_row.homeowner_id
  for update;

  if membership_row.status <> 'active'
    or membership_row.payment_setup_completed_at is null
    or membership_row.agreement_id is null
    or nullif(pg_catalog.btrim(coalesce(membership_row.sales_tier, '')), '') is null
    or membership_row.visit_price is null
    or not found
  then
    raise exception 'jobber_link_conflict: Membership is not strictly active at the exact property';
  end if;

  select * into agreement_row
  from public.signed_agreements agreement
  where agreement.id = membership_row.agreement_id
    and agreement.status = 'complete'
    and agreement.membership_id = membership_row.id
    and agreement.property_id = property_row.id
    and agreement.homeowner_id = property_row.homeowner_id
  for update;
  if not found then
    raise exception 'jobber_link_conflict: Completed signed agreement does not match the membership property';
  end if;

  if existing_link.id is not null and existing_link.link_state = 'active' then
    if existing_link.membership_id = membership_row.id
      and existing_link.property_id = property_row.id
    then
      -- Never regress the current proof when retries arrive out of observation
      -- order. Every valid proof is still appended to the immutable ledger.
      if existing_link.ownership_observed_at is null
        or requested_ownership_observed_at >= existing_link.ownership_observed_at
      then
        update public.jobber_property_links
        set jobber_client_id = requested_jobber_client_id,
            jobber_property_web_uri = requested_jobber_property_web_uri,
            observed_graphql_version = pg_catalog.btrim(requested_graphql_version),
            ownership_observed_at = requested_ownership_observed_at,
            ownership_pages_scanned = requested_ownership_pages_scanned,
            property_coverage_complete = true
        where id = existing_link.id
          and link_state = 'active'
          and membership_id = membership_row.id
          and property_id = property_row.id
        returning * into linked_row;
        if not found then
          raise exception 'jobber_link_conflict: Property link changed during ownership verification';
        end if;
      else
        linked_row := existing_link;
      end if;

      insert into public.jobber_property_link_events (
        link_id, event_type, external_property_id, previous_property_id,
        property_id, previous_membership_id, membership_id, actor, reason,
        jobber_client_id, jobber_property_web_uri, observed_graphql_version,
        ownership_observed_at, ownership_pages_scanned,
        property_coverage_complete, occurred_at
      ) values (
        linked_row.id, 'ownership_verified', linked_row.external_property_id,
        null, linked_row.property_id, null, linked_row.membership_id,
        requested_actor_id::text,
        'Headquarters refreshed verified Jobber client-property ownership evidence',
        requested_jobber_client_id, requested_jobber_property_web_uri,
        pg_catalog.btrim(requested_graphql_version),
        requested_ownership_observed_at, requested_ownership_pages_scanned,
        true, changed_at
      );

      return pg_catalog.jsonb_build_object(
        'outcome', 'already_linked',
        'link_id', linked_row.id
      );
    end if;
    raise exception 'jobber_link_conflict: Jobber property already has a different active link';
  end if;

  if property_conflict.id is not null then
    raise exception 'jobber_link_conflict: HomeAtlas property already has a different active Jobber link';
  end if;

  if existing_link.id is null then
    insert into public.jobber_property_links (
      connection_id, external_property_id, property_id, membership_id,
      link_state, linked_by, link_reason, linked_at, jobber_client_id,
      jobber_property_web_uri, observed_graphql_version,
      ownership_observed_at, ownership_pages_scanned,
      property_coverage_complete
    ) values (
      requested_connection_id, requested_external_property_id,
      property_row.id, membership_row.id, 'active', requested_actor_id::text,
      'Headquarters confirmed the same physical property in Jobber and HomeAtlas',
      changed_at, requested_jobber_client_id,
      requested_jobber_property_web_uri,
      pg_catalog.btrim(requested_graphql_version),
      requested_ownership_observed_at, requested_ownership_pages_scanned, true
    ) returning * into linked_row;
  else
    update public.jobber_property_links
    set property_id = property_row.id,
        membership_id = membership_row.id,
        link_state = 'active',
        linked_by = requested_actor_id::text,
        link_reason = 'Headquarters confirmed the same physical property in Jobber and HomeAtlas',
        linked_at = changed_at,
        revoked_by = null,
        revoke_reason = null,
        revoked_at = null,
        jobber_client_id = requested_jobber_client_id,
        jobber_property_web_uri = requested_jobber_property_web_uri,
        observed_graphql_version = pg_catalog.btrim(requested_graphql_version),
        ownership_observed_at = requested_ownership_observed_at,
        ownership_pages_scanned = requested_ownership_pages_scanned,
        property_coverage_complete = true
    where id = existing_link.id
      and link_state = 'revoked'
    returning * into linked_row;
    if not found then
      raise exception 'jobber_link_conflict: Property link changed during review';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'linked',
    'link_id', linked_row.id
  );
end;
$$;

revoke all on function public.link_jobber_member_property_from_search(
  uuid, text, text, text, text, text, timestamptz, integer, boolean, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.link_jobber_member_property_from_search(
  uuid, text, text, text, text, text, timestamptz, integer, boolean, uuid, boolean
) to service_role;

alter table public.jobber_property_links enable row level security;
alter table public.jobber_property_link_events enable row level security;

comment on function public.link_jobber_member_property_from_search(
  uuid, text, text, text, text, text, timestamptz, integer, boolean, uuid, boolean
) is 'Atomically validates active HQ authority, complete provider ownership evidence, exact signed membership/property identity, and supervised Jobber property-link uniqueness.';
