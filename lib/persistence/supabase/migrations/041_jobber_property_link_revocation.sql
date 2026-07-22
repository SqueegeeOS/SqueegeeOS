-- Atomic fail-closed Jobber property-link revocation.
-- This migration changes only Jobber classification/appointment authority.
-- It never deletes history and performs no obligation, pricing, billing,
-- Stripe, agreement, membership, or Property Memory writes.

alter table public.jobber_property_links
  add column if not exists revocation_projection_id uuid
    references public.jobber_visit_projections(id) on delete restrict,
  add column if not exists revocation_expected_link_updated_at timestamptz;

alter table public.jobber_property_link_events
  add column if not exists revocation_projection_id uuid
    references public.jobber_visit_projections(id) on delete restrict,
  add column if not exists revocation_expected_link_updated_at timestamptz;

-- Keep migration 034's automatic immutable link event as the only revocation
-- event insertion point. The request identity copied here makes an exact lost-
-- response replay provable without inserting a duplicate event.
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
    property_coverage_complete, revocation_projection_id,
    revocation_expected_link_updated_at
  ) values (
    new.id, next_event_type, new.external_property_id,
    case when tg_op = 'UPDATE' then old.property_id else null end,
    new.property_id,
    case when tg_op = 'UPDATE' then old.membership_id else null end,
    new.membership_id, event_actor, event_reason, new.jobber_client_id,
    new.jobber_property_web_uri, new.observed_graphql_version,
    new.ownership_observed_at, new.ownership_pages_scanned,
    new.property_coverage_complete,
    case when next_event_type = 'revoked' then new.revocation_projection_id else null end,
    case when next_event_type = 'revoked' then new.revocation_expected_link_updated_at else null end
  );

  return new;
end;
$$;

create or replace function public.invalidate_jobber_visit_authority_for_property_link(
  requested_link_id uuid,
  requested_reason text,
  requested_changed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  classification_row public.jobber_visit_classifications%rowtype;
  classification_count integer := 0;
  appointment_count integer := 0;
  updated_count integer := 0;
begin
  if requested_link_id is null
    or requested_changed_at is null
    or nullif(pg_catalog.btrim(coalesce(requested_reason, '')), '') is null
  then
    raise exception 'jobber_link_revoke_invalid: complete invalidation input is required';
  end if;

  -- Approval locks the exact link before classification/appointment authority.
  -- Every caller of this helper already holds that link lock, so an approval
  -- either commits first and is included below, or waits and observes the
  -- revoked/changed link. No approved decision can survive the transaction.
  for classification_row in
    select *
    from public.jobber_visit_classifications classification
    where classification.property_link_id = requested_link_id
      and classification.classification_state = 'approved'
    for update
  loop
    update public.jobber_visit_classifications
    set classification_state = 'pending_review',
        updated_at = requested_changed_at
    where id = classification_row.id
      and classification_state = 'approved';
    if not found then
      raise exception 'jobber_link_revoke_conflict: Visit classification changed during invalidation';
    end if;
    classification_count := classification_count + 1;

    update public.member_appointments
    set verification_state = 'pending_review',
        match_state = 'manual_review',
        jobber_authority_state = 'pending_review'
    where jobber_property_link_id = requested_link_id
      and jobber_visit_classification_id = classification_row.id
      and jobber_authority_state = 'approved';
    get diagnostics updated_count = row_count;
    appointment_count := appointment_count + updated_count;

    insert into public.jobber_visit_classification_events (
      classification_id, event_type, actor_id, reason, projection_id,
      connection_id, external_visit_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      scheduled_start, appointment_id, projection_snapshot, occurred_at
    ) values (
      classification_row.id, 'property_link_invalidated', null,
      pg_catalog.btrim(requested_reason), classification_row.projection_id,
      classification_row.connection_id, classification_row.external_visit_id,
      classification_row.source_payload_hash,
      classification_row.source_observed_at,
      classification_row.external_property_id,
      classification_row.property_link_id,
      classification_row.property_link_updated_at,
      classification_row.membership_id, classification_row.property_id,
      classification_row.service_type, classification_row.scheduled_start,
      classification_row.appointment_id,
      classification_row.projection_snapshot, requested_changed_at
    );
  end loop;

  -- Fail closed over any drifted authoritative appointment that still names
  -- this link, even if its mutable classification pairing was already damaged.
  update public.member_appointments
  set verification_state = 'pending_review',
      match_state = 'manual_review',
      jobber_authority_state = 'pending_review'
  where jobber_property_link_id = requested_link_id
    and jobber_authority_state = 'approved';
  get diagnostics updated_count = row_count;
  appointment_count := appointment_count + updated_count;

  if exists (
    select 1
    from public.jobber_visit_classifications classification
    where classification.property_link_id = requested_link_id
      and classification.classification_state = 'approved'
  ) or exists (
    select 1
    from public.member_appointments appointment
    where appointment.jobber_property_link_id = requested_link_id
      and appointment.jobber_authority_state = 'approved'
  ) then
    raise exception 'jobber_link_revoke_conflict: Approved visit authority survived invalidation';
  end if;

  return pg_catalog.jsonb_build_object(
    'classification_count', classification_count,
    'appointment_count', appointment_count
  );
end;
$$;

create or replace function public.invalidate_jobber_visit_classification_on_link_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.updated_at is not distinct from new.updated_at then
    return new;
  end if;

  perform public.invalidate_jobber_visit_authority_for_property_link(
    old.id,
    'The reviewed property-link token changed; reapproval is required',
    pg_catalog.clock_timestamp()
  );
  return new;
end;
$$;

create or replace function public.revoke_jobber_property_link(
  requested_actor_id uuid,
  requested_connection_id text,
  requested_projection_id uuid,
  requested_link_id uuid,
  requested_expected_link_updated_at timestamptz,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz;
  actor_row public.hq_admin_users%rowtype;
  connection_row public.jobber_connections%rowtype;
  sync_lock_row public.jobber_schedule_sync_locks%rowtype;
  projection_row public.jobber_visit_projections%rowtype;
  link_row public.jobber_property_links%rowtype;
begin
  if requested_actor_id is null
    or requested_connection_id is null
    or nullif(pg_catalog.btrim(requested_connection_id), '') is null
    or requested_projection_id is null
    or requested_link_id is null
    or requested_expected_link_updated_at is null
    or nullif(pg_catalog.btrim(coalesce(requested_reason, '')), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(requested_reason)) > 1000
  then
    raise exception 'jobber_link_revoke_invalid: complete revocation input is required';
  end if;

  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'jobber_link_revoke_forbidden: Headquarters actor is not active';
  end if;

  -- Match the connection -> sync lock -> projection -> link order shared by
  -- migrations 038-040. The exact link lock is the serialization point with
  -- visit approval and with supervised relinking.
  select * into connection_row
  from public.jobber_connections connection
  where connection.id = pg_catalog.btrim(requested_connection_id)
  for update;
  if not found then
    raise exception 'jobber_link_revoke_not_found: Jobber connection was not found';
  end if;

  select * into sync_lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = connection_row.id
  for update;
  if not found then
    raise exception 'jobber_link_revoke_conflict: Jobber connection authority is incomplete';
  end if;

  select * into projection_row
  from public.jobber_visit_projections projection
  where projection.id = requested_projection_id
  for update;
  if not found then
    raise exception 'jobber_link_revoke_not_found: Jobber visit projection was not found';
  end if;
  if projection_row.connection_id <> connection_row.id then
    raise exception 'jobber_link_revoke_conflict: Jobber projection connection changed';
  end if;

  select * into link_row
  from public.jobber_property_links property_link
  where property_link.id = requested_link_id
  for update;
  if not found then
    raise exception 'jobber_link_revoke_conflict: Reviewed Jobber property link no longer exists';
  end if;
  if link_row.connection_id <> connection_row.id
    or link_row.external_property_id <> projection_row.external_property_id
  then
    raise exception 'jobber_link_revoke_conflict: Jobber property link identity changed';
  end if;

  changed_at := pg_catalog.clock_timestamp();

  if link_row.link_state = 'revoked' then
    -- Only the exact original request is a replay. The immutable trigger event
    -- proves the actor, projection, reason, and pre-revocation link version;
    -- every stale or different request fails closed without another write.
    if link_row.revoked_by is distinct from requested_actor_id::text
      or link_row.revoke_reason is distinct from pg_catalog.btrim(requested_reason)
      or link_row.revocation_projection_id is distinct from requested_projection_id
      or link_row.revocation_expected_link_updated_at is distinct from requested_expected_link_updated_at
      or not exists (
        select 1
        from public.jobber_property_link_events event
        where event.link_id = link_row.id
          and event.event_type = 'revoked'
          and event.actor = requested_actor_id::text
          and event.reason = pg_catalog.btrim(requested_reason)
          and event.revocation_projection_id = requested_projection_id
          and event.revocation_expected_link_updated_at = requested_expected_link_updated_at
      )
    then
      raise exception 'jobber_link_revoke_conflict: Revocation replay did not match';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_jobber_only',
      'link_id', link_row.id
    );
  end if;

  if link_row.link_state <> 'active'
    or link_row.updated_at <> requested_expected_link_updated_at
  then
    raise exception 'jobber_link_revoke_conflict: Jobber property link changed while under review';
  end if;

  update public.jobber_property_links
  set link_state = 'revoked',
      revoked_by = requested_actor_id::text,
      revoke_reason = pg_catalog.btrim(requested_reason),
      revoked_at = changed_at,
      revocation_projection_id = requested_projection_id,
      revocation_expected_link_updated_at = requested_expected_link_updated_at
  where id = link_row.id
    and connection_id = connection_row.id
    and link_state = 'active'
    and updated_at = requested_expected_link_updated_at
  returning * into link_row;
  if not found then
    raise exception 'jobber_link_revoke_conflict: Jobber property link changed while under review';
  end if;

  if exists (
    select 1
    from public.jobber_visit_classifications classification
    where classification.property_link_id = link_row.id
      and classification.classification_state = 'approved'
  ) or exists (
    select 1
    from public.member_appointments appointment
    where appointment.jobber_property_link_id = link_row.id
      and appointment.jobber_authority_state = 'approved'
  ) then
    raise exception 'jobber_link_revoke_conflict: Approved visit authority survived revocation';
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'revoked',
    'link_id', link_row.id
  );
end;
$$;

revoke all on function public.invalidate_jobber_visit_authority_for_property_link(
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.invalidate_jobber_visit_classification_on_link_change()
from public, anon, authenticated, service_role;
revoke all on function public.revoke_jobber_property_link(
  uuid, text, uuid, uuid, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.revoke_jobber_property_link(
  uuid, text, uuid, uuid, timestamptz, text
) to service_role;

alter table public.jobber_property_links enable row level security;
alter table public.jobber_property_link_events enable row level security;
alter table public.jobber_visit_classifications enable row level security;
alter table public.jobber_visit_classification_events enable row level security;
alter table public.member_appointments enable row level security;

comment on function public.revoke_jobber_property_link(
  uuid, text, uuid, uuid, timestamptz, text
) is 'Atomically locks and revalidates the active HQ actor plus exact Jobber connection, projection, property link, and link version before revoking every visit authority derived from that link.';
