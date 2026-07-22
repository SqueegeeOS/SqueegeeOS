-- Supervised, per-visit Jobber classification.
-- One authenticated Headquarters decision may promote one stable, future
-- Jobber visit into one HomeAtlas appointment. No obligation, pricing,
-- billing, Stripe, agreement, membership, add-on, or Property Memory writes.

-- Migration 038's started_at default uses transaction-scoped now(). A sync
-- transaction can begin early, wait on the per-connection reservation lock,
-- and otherwise sort behind a run it causally follows. Assign this monotonic
-- sequence only when the post-lock run insert executes, and use it for every
-- current-run decision. Existing rows are backfilled deterministically before
-- the default becomes authoritative for new reservations.
create sequence if not exists public.jobber_schedule_sync_reservation_sequence;

alter table public.jobber_schedule_sync_runs
  add column if not exists reservation_sequence bigint;

with existing_max as (
  select coalesce(
    pg_catalog.max(reservation_sequence),
    0::pg_catalog.int8
  ) as value
  from public.jobber_schedule_sync_runs
), missing as (
  select run.id,
    pg_catalog.row_number() over (
      order by run.started_at, run.id
    ) + existing_max.value as value
  from public.jobber_schedule_sync_runs run
  cross join existing_max
  where run.reservation_sequence is null
)
update public.jobber_schedule_sync_runs run
set reservation_sequence = missing.value
from missing
where run.id = missing.id;

do $$
declare
  max_reservation_sequence bigint;
  sequence_last_value bigint;
  sequence_is_called boolean;
begin
  select coalesce(
    pg_catalog.max(run.reservation_sequence),
    0::pg_catalog.int8
  )
  into max_reservation_sequence
  from public.jobber_schedule_sync_runs run;

  select last_value, is_called
  into sequence_last_value, sequence_is_called
  from public.jobber_schedule_sync_reservation_sequence;

  if max_reservation_sequence = 0 then
    perform pg_catalog.setval(
      'public.jobber_schedule_sync_reservation_sequence'::pg_catalog.regclass,
      1,
      false
    );
  elsif not sequence_is_called or sequence_last_value < max_reservation_sequence then
    perform pg_catalog.setval(
      'public.jobber_schedule_sync_reservation_sequence'::pg_catalog.regclass,
      max_reservation_sequence,
      true
    );
  end if;
end;
$$;

alter table public.jobber_schedule_sync_runs
  alter column reservation_sequence set default
    pg_catalog.nextval('public.jobber_schedule_sync_reservation_sequence'::pg_catalog.regclass),
  alter column reservation_sequence set not null;

alter sequence public.jobber_schedule_sync_reservation_sequence
  owned by public.jobber_schedule_sync_runs.reservation_sequence;

create unique index if not exists jobber_schedule_sync_runs_reservation_sequence_unique
  on public.jobber_schedule_sync_runs(reservation_sequence);

create table if not exists public.jobber_visit_classifications (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  external_visit_id text not null,
  projection_id uuid not null references public.jobber_visit_projections(id) on delete restrict,
  source_payload_hash text not null check (source_payload_hash ~ '^[0-9a-f]{64}$'),
  source_observed_at timestamptz not null,
  external_property_id text not null,
  property_link_id uuid not null references public.jobber_property_links(id) on delete restrict,
  property_link_updated_at timestamptz not null,
  membership_id uuid not null references public.memberships(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  service_type text not null check (
    service_type in ('home_care_visit', 'exterior_windows', 'pressure_wash')
  ),
  classification_state text not null check (
    classification_state in ('pending_review', 'approved', 'rejected', 'revoked')
  ),
  decision_actor_id uuid not null references public.hq_admin_users(user_id) on delete restrict,
  decision_reason text not null check (
    nullif(btrim(decision_reason), '') is not null
    and char_length(btrim(decision_reason)) <= 1000
  ),
  projection_snapshot jsonb not null,
  scheduled_start timestamptz,
  appointment_id uuid references public.member_appointments(id) on delete restrict,
  decided_at timestamptz not null,
  approved_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_visit_id),
  check (nullif(btrim(external_visit_id), '') is not null),
  check (nullif(btrim(external_property_id), '') is not null),
  check (
    (classification_state = 'approved' and approved_at is not null and appointment_id is not null)
    or classification_state <> 'approved'
  )
);

create index if not exists jobber_visit_classifications_review_idx
  on public.jobber_visit_classifications(classification_state, scheduled_start);
create index if not exists jobber_visit_classifications_link_idx
  on public.jobber_visit_classifications(property_link_id, property_link_updated_at);

create table if not exists public.jobber_visit_classification_events (
  id uuid primary key default gen_random_uuid(),
  classification_id uuid not null references public.jobber_visit_classifications(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'approved', 'rejected', 'revoked', 'binding_detached',
      'source_invalidated', 'property_link_invalidated',
      'manifest_omission_invalidated'
    )
  ),
  actor_id uuid references public.hq_admin_users(user_id) on delete restrict,
  reason text not null check (
    nullif(btrim(reason), '') is not null
    and char_length(btrim(reason)) <= 1000
  ),
  projection_id uuid not null references public.jobber_visit_projections(id) on delete restrict,
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  external_visit_id text not null,
  source_payload_hash text not null check (source_payload_hash ~ '^[0-9a-f]{64}$'),
  source_observed_at timestamptz not null,
  external_property_id text not null,
  property_link_id uuid not null references public.jobber_property_links(id) on delete restrict,
  property_link_updated_at timestamptz not null,
  membership_id uuid not null references public.memberships(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  service_type text not null check (
    service_type in ('home_care_visit', 'exterior_windows', 'pressure_wash')
  ),
  scheduled_start timestamptz,
  appointment_id uuid references public.member_appointments(id) on delete restrict,
  projection_snapshot jsonb not null,
  occurred_at timestamptz not null default now(),
  check (
    (
      event_type in ('approved', 'rejected', 'revoked', 'binding_detached')
      and actor_id is not null
    )
    or (
      event_type in (
        'source_invalidated', 'property_link_invalidated',
        'manifest_omission_invalidated'
      )
      and actor_id is null
    )
  )
);

create index if not exists jobber_visit_classification_events_classification_idx
  on public.jobber_visit_classification_events(classification_id, occurred_at);

alter table public.member_appointments
  add column if not exists jobber_visit_classification_id uuid
    references public.jobber_visit_classifications(id) on delete restrict,
  add column if not exists jobber_connection_id text
    references public.jobber_connections(id) on delete restrict,
  add column if not exists jobber_projection_id uuid
    references public.jobber_visit_projections(id) on delete restrict,
  add column if not exists jobber_property_link_id uuid
    references public.jobber_property_links(id) on delete restrict,
  add column if not exists jobber_membership_id uuid
    references public.memberships(id) on delete restrict,
  add column if not exists jobber_authority_state text,
  add column if not exists jobber_property_link_updated_at timestamptz;

alter table public.member_appointments
  drop constraint if exists member_appointments_jobber_authority_state_check,
  add constraint member_appointments_jobber_authority_state_check check (
    jobber_authority_state is null
    or jobber_authority_state in ('approved', 'pending_review', 'rejected', 'revoked')
  ),
  drop constraint if exists member_appointments_jobber_authority_binding_check,
  add constraint member_appointments_jobber_authority_binding_check check (
    jobber_authority_state <> 'approved'
    or (
      provider = 'jobber'
      and nullif(btrim(external_id), '') is not null
      and jobber_visit_classification_id is not null
      and jobber_connection_id is not null
      and jobber_projection_id is not null
      and jobber_property_link_id is not null
      and jobber_membership_id is not null
      and jobber_property_link_updated_at is not null
      and source_payload_hash is not null
      and matched_obligation_id is null
      and status = 'scheduled'
      and completed_at is null
    )
  );

create unique index if not exists member_appointments_jobber_classification_unique
  on public.member_appointments(jobber_visit_classification_id)
  where jobber_visit_classification_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_appointments_jobber_membership_property_fkey'
  ) then
    alter table public.member_appointments
      add constraint member_appointments_jobber_membership_property_fkey
      foreign key (jobber_membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
end;
$$;

create or replace function public.reject_jobber_visit_classification_event_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber visit classification events are append-only and immutable';
end;
$$;

drop trigger if exists jobber_visit_classification_events_immutable
  on public.jobber_visit_classification_events;
create trigger jobber_visit_classification_events_immutable
  before update or delete on public.jobber_visit_classification_events
  for each row execute function public.reject_jobber_visit_classification_event_change();

create or replace function public.reject_jobber_visit_classification_delete()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber visit classifications must be revoked, never deleted';
end;
$$;

drop trigger if exists jobber_visit_classifications_no_delete
  on public.jobber_visit_classifications;
create trigger jobber_visit_classifications_no_delete
  before delete on public.jobber_visit_classifications
  for each row execute function public.reject_jobber_visit_classification_delete();

create or replace function public.decide_jobber_visit_classification(
  requested_action text,
  requested_projection_id uuid,
  requested_source_payload_hash text,
  requested_property_link_id uuid,
  requested_property_link_updated_at timestamptz,
  requested_membership_id uuid,
  requested_property_id uuid,
  requested_service_type text,
  requested_reason text,
  requested_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  actor_row public.hq_admin_users%rowtype;
  sync_lock_row public.jobber_schedule_sync_locks%rowtype;
  projection_connection_id text;
  projection_row public.jobber_visit_projections%rowtype;
  link_row public.jobber_property_links%rowtype;
  membership_row public.memberships%rowtype;
  watermark_row public.jobber_schedule_sync_watermarks%rowtype;
  coverage_run_row public.jobber_schedule_sync_runs%rowtype;
  profile_id uuid;
  classification_row public.jobber_visit_classifications%rowtype;
  appointment_row public.member_appointments%rowtype;
  snapshot jsonb;
  is_approval boolean;
begin
  is_approval := requested_action = 'approve';
  if requested_action is null
    or requested_action not in ('approve', 'reject')
    or requested_projection_id is null
    or requested_property_link_id is null
    or requested_membership_id is null
    or requested_property_id is null
    or requested_actor_id is null
    or requested_source_payload_hash is null
    or requested_service_type is null
    or requested_source_payload_hash !~ '^[0-9a-f]{64}$'
    or requested_property_link_updated_at is null
    or requested_service_type not in ('home_care_visit', 'exterior_windows', 'pressure_wash')
    or nullif(pg_catalog.btrim(coalesce(requested_reason, '')), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(requested_reason)) > 1000
  then
    raise exception 'classification_invalid: invalid decision input';
  end if;

  -- FOR SHARE conflicts with an active/role deactivation update. The decision
  -- therefore commits before deactivation, or waits and observes the inactive
  -- row; it cannot authorize across an uncommitted deactivation.
  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'classification_conflict: Headquarters actor is not active';
  end if;

  -- Read only the connection key before taking provider row locks. PR2 begin
  -- locks this exact connection lock before reserving a run; PR2 finalization
  -- locks its run and then this row. This decision never locks a run row, so
  -- the compatible order is actor -> sync lock -> projection/link/membership
  -- -> watermark -> classification/appointment with no reverse run edge.
  select projection.connection_id into projection_connection_id
  from public.jobber_visit_projections projection
  where projection.id = requested_projection_id;
  if not found then
    raise exception 'classification_not_found: Jobber visit projection was not found';
  end if;

  select * into sync_lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = projection_connection_id
  for update;
  if not found or sync_lock_row.active_run_id is not null then
    raise exception 'classification_conflict: Current Jobber coverage is not complete and stable';
  end if;
  -- Freshness and future-time checks must use time after any lock wait.
  changed_at := pg_catalog.clock_timestamp();

  select * into projection_row
  from public.jobber_visit_projections projection
  where projection.id = requested_projection_id
  for update;
  if not found then
    raise exception 'classification_not_found: Jobber visit projection was not found';
  end if;
  if projection_row.connection_id <> projection_connection_id
    or projection_row.source_payload_hash <> requested_source_payload_hash
  then
    raise exception 'classification_conflict: Jobber visit source changed';
  end if;

  select * into link_row
  from public.jobber_property_links property_link
  where property_link.id = requested_property_link_id
  for update;
  if not found then
    raise exception 'classification_not_found: Jobber property link was not found';
  end if;
  if link_row.link_state <> 'active'
    or link_row.updated_at <> requested_property_link_updated_at
    or link_row.connection_id <> projection_row.connection_id
    or link_row.external_property_id <> projection_row.external_property_id
    or link_row.membership_id <> requested_membership_id
    or link_row.property_id <> requested_property_id
  then
    raise exception 'classification_conflict: Jobber property link changed or does not match the visit';
  end if;

  select * into membership_row
  from public.memberships membership
  where membership.id = requested_membership_id
    and membership.property_id = requested_property_id
  for update;
  if not found then
    raise exception 'classification_conflict: Membership does not match the property';
  end if;
  if membership_row.status <> 'active'
    or membership_row.payment_setup_completed_at is null
    or membership_row.agreement_id is null
    or nullif(pg_catalog.btrim(coalesce(membership_row.sales_tier, '')), '') is null
    or membership_row.visit_price is null
    or not exists (
      select 1
      from public.properties property
      join public.signed_agreements agreement
        on agreement.id = membership_row.agreement_id
       and agreement.status = 'complete'
       and agreement.membership_id = membership_row.id
       and agreement.property_id = membership_row.property_id
       and agreement.homeowner_id = membership_row.homeowner_id
      where property.id = membership_row.property_id
        and property.homeowner_id = membership_row.homeowner_id
    )
  then
    raise exception 'classification_conflict: Membership is not strictly active at the exact property';
  end if;

  select profile.id into profile_id
  from public.member_profiles profile
  where profile.homeowner_id = membership_row.homeowner_id;
  if profile_id is null then
    raise exception 'classification_conflict: Member profile is required before appointment promotion';
  end if;

  -- Lock the current watermark through the whole decision. A concurrent
  -- finalizer must run after this transaction and will then demote any visit
  -- omitted by its complete manifest.
  select * into watermark_row
  from public.jobber_schedule_sync_watermarks watermark
  where watermark.connection_id = projection_row.connection_id
  for update;
  if not found
    or watermark_row.covered_at < changed_at - pg_catalog.make_interval(mins => 30)
    or watermark_row.covered_at > changed_at
  then
    raise exception 'classification_conflict: Current Jobber coverage is not complete and fresh';
  end if;

  select * into coverage_run_row
  from public.jobber_schedule_sync_runs run
  where run.id = watermark_row.run_id;
  if not found
    or coverage_run_row.connection_id <> projection_row.connection_id
    or coverage_run_row.status <> 'complete'
    or coverage_run_row.completed_at is null
    or coverage_run_row.completed_at <> watermark_row.covered_at
    or coverage_run_row.window_start <> watermark_row.window_start
    or coverage_run_row.window_end <> watermark_row.window_end
    or (
      select latest.id
      from public.jobber_schedule_sync_runs latest
      where latest.connection_id = projection_row.connection_id
      order by latest.reservation_sequence desc
      limit 1
    ) is distinct from coverage_run_row.id
  then
    raise exception 'classification_conflict: Current Jobber coverage is not complete and fresh';
  end if;

  if not exists (
    select 1
    from public.jobber_visit_source_observations observation
    where observation.run_id = watermark_row.run_id
      and observation.pass_number = 2
      and observation.external_visit_id = projection_row.external_visit_id
      and observation.source_payload_hash = projection_row.source_payload_hash
      and observation.source_observed_at = projection_row.source_observed_at
  ) then
    raise exception 'classification_conflict: Visit is not in the current coverage-proven manifest';
  end if;

  if is_approval and (
    projection_row.visit_status <> 'UPCOMING'
    or projection_row.is_complete is distinct from false
    or projection_row.completed_at is not null
    or projection_row.scheduled_start is null
    or projection_row.scheduled_start <= changed_at
  ) then
    raise exception 'classification_conflict: Only an unambiguously future UPCOMING visit may be promoted';
  end if;

  snapshot := pg_catalog.to_jsonb(projection_row);
  -- member_appointments has one global provider/external identity, so serialize
  -- every connection and projection that could contend for that exact key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'member_appointments:jobber:' || projection_row.external_visit_id,
      0
    )
  );
  select * into classification_row
  from public.jobber_visit_classifications classification
  where classification.connection_id = projection_row.connection_id
    and classification.external_visit_id = projection_row.external_visit_id
  for update;

  if found
    and (
      (is_approval and classification_row.classification_state = 'approved')
      or (
        not is_approval
        and classification_row.classification_state = 'rejected'
      )
    )
    and classification_row.projection_id = projection_row.id
    and classification_row.source_payload_hash = projection_row.source_payload_hash
    and classification_row.property_link_id = link_row.id
    and classification_row.property_link_updated_at = link_row.updated_at
    and classification_row.membership_id = membership_row.id
    and classification_row.property_id = membership_row.property_id
    and classification_row.service_type = requested_service_type
    and classification_row.decision_actor_id = requested_actor_id
    and classification_row.decision_reason = pg_catalog.btrim(requested_reason)
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'replay',
      'classification_id', classification_row.id,
      'appointment_id', classification_row.appointment_id
    );
  elsif found and classification_row.classification_state = 'approved' then
    raise exception 'classification_conflict: Visit classification changed while under review';
  end if;

  if not found then
    insert into public.jobber_visit_classifications (
      connection_id, external_visit_id, projection_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      classification_state, decision_actor_id, decision_reason,
      projection_snapshot, scheduled_start, decided_at
    ) values (
      projection_row.connection_id, projection_row.external_visit_id,
      projection_row.id, projection_row.source_payload_hash,
      projection_row.source_observed_at, projection_row.external_property_id,
      link_row.id, link_row.updated_at, membership_row.id,
      membership_row.property_id, requested_service_type, 'pending_review',
      requested_actor_id, pg_catalog.btrim(requested_reason), snapshot,
      projection_row.scheduled_start, changed_at
    ) returning * into classification_row;
  else
    if classification_row.appointment_id is not null then
      -- Lock and validate the complete historical binding before changing any
      -- mutable classification evidence. This permits a supervised same-home
      -- source/schedule advance, but no unrelated same-ID appointment can be
      -- adopted and no mismatched appointment can be silently detached.
      select * into appointment_row
      from public.member_appointments appointment
      where appointment.id = classification_row.appointment_id
      for update;
      if not found
        or appointment_row.provider is distinct from 'jobber'
        or appointment_row.external_id is distinct from classification_row.external_visit_id
        or appointment_row.property_id is distinct from classification_row.property_id
        or appointment_row.service_type is distinct from classification_row.service_type
        or appointment_row.scheduled_at is distinct from classification_row.scheduled_start
        or appointment_row.provenance_state is distinct from 'provider_imported'
        or appointment_row.jobber_visit_classification_id is distinct from classification_row.id
        or appointment_row.jobber_connection_id is distinct from classification_row.connection_id
        or appointment_row.jobber_projection_id is distinct from classification_row.projection_id
        or appointment_row.jobber_property_link_id is distinct from classification_row.property_link_id
        or appointment_row.jobber_membership_id is distinct from classification_row.membership_id
        or appointment_row.jobber_property_link_updated_at is distinct from classification_row.property_link_updated_at
        or appointment_row.source_payload_hash is distinct from classification_row.source_payload_hash
        or appointment_row.source_observed_at is distinct from classification_row.source_observed_at
        or appointment_row.matched_obligation_id is not null
        or appointment_row.status is distinct from 'scheduled'
        or appointment_row.completed_at is not null
        or not exists (
          select 1
          from public.member_profiles old_profile
          join public.memberships old_membership
            on old_membership.id = classification_row.membership_id
           and old_membership.property_id = classification_row.property_id
           and old_membership.homeowner_id = old_profile.homeowner_id
          where old_profile.id = appointment_row.member_profile_id
        )
      then
        raise exception 'classification_conflict: Prior appointment binding changed before classification rebinding';
      end if;

      if classification_row.property_link_id <> link_row.id
        or classification_row.membership_id <> membership_row.id
        or classification_row.property_id <> membership_row.property_id
        or (
          not is_approval
          and (
            classification_row.projection_id is distinct from projection_row.id
            or classification_row.source_payload_hash is distinct from projection_row.source_payload_hash
            or classification_row.source_observed_at is distinct from projection_row.source_observed_at
            or classification_row.external_property_id is distinct from projection_row.external_property_id
            or classification_row.property_link_updated_at is distinct from link_row.updated_at
            or classification_row.service_type is distinct from requested_service_type
            or classification_row.scheduled_start is distinct from projection_row.scheduled_start
          )
        )
      then
        -- Preserve the old appointment pairing in immutable evidence before
        -- both live FK directions are detached and current evidence changes.
        -- Approval alone may advance appointment authority tokens; rejection
        -- records changed evidence without rewriting the old appointment.
        insert into public.jobber_visit_classification_events (
          classification_id, event_type, actor_id, reason, projection_id,
          connection_id, external_visit_id, source_payload_hash,
          source_observed_at, external_property_id, property_link_id,
          property_link_updated_at, membership_id, property_id, service_type,
          scheduled_start, appointment_id, projection_snapshot, occurred_at
        ) values (
          classification_row.id, 'binding_detached', requested_actor_id,
          'Prior appointment identity detached before classification rebinding',
          classification_row.projection_id, classification_row.connection_id,
          classification_row.external_visit_id,
          classification_row.source_payload_hash,
          classification_row.source_observed_at,
          classification_row.external_property_id,
          classification_row.property_link_id,
          classification_row.property_link_updated_at,
          classification_row.membership_id, classification_row.property_id,
          classification_row.service_type, classification_row.scheduled_start,
          classification_row.appointment_id,
          classification_row.projection_snapshot, changed_at
        );
        update public.member_appointments
        set jobber_visit_classification_id = null,
            jobber_authority_state = 'pending_review'
        where id = classification_row.appointment_id;
        classification_row.appointment_id := null;
      end if;
    end if;
    update public.jobber_visit_classifications
    set projection_id = projection_row.id,
        source_payload_hash = projection_row.source_payload_hash,
        source_observed_at = projection_row.source_observed_at,
        external_property_id = projection_row.external_property_id,
        property_link_id = link_row.id,
        property_link_updated_at = link_row.updated_at,
        membership_id = membership_row.id,
        property_id = membership_row.property_id,
        service_type = requested_service_type,
        classification_state = 'pending_review',
        decision_actor_id = requested_actor_id,
        decision_reason = pg_catalog.btrim(requested_reason),
        projection_snapshot = snapshot,
        scheduled_start = projection_row.scheduled_start,
        appointment_id = classification_row.appointment_id,
        decided_at = changed_at,
        updated_at = changed_at
    where id = classification_row.id
    returning * into classification_row;
  end if;

  if is_approval then
    select * into appointment_row
    from public.member_appointments appointment
    where appointment.provider = 'jobber'
      and appointment.external_id = projection_row.external_visit_id
    for update;
    if found and (
      appointment_row.member_profile_id is distinct from profile_id
      or appointment_row.property_id is distinct from membership_row.property_id
      or appointment_row.provenance_state is distinct from 'provider_imported'
      or appointment_row.jobber_visit_classification_id is distinct from classification_row.id
      or appointment_row.jobber_connection_id is distinct from projection_row.connection_id
      or appointment_row.jobber_projection_id is distinct from projection_row.id
      or appointment_row.jobber_property_link_id is distinct from link_row.id
      or appointment_row.jobber_membership_id is distinct from membership_row.id
      or appointment_row.matched_obligation_id is not null
      or appointment_row.status is distinct from 'scheduled'
      or appointment_row.completed_at is not null
    ) then
      raise exception 'classification_conflict: Existing appointment identity belongs to different authority';
    end if;

    if not found then
      insert into public.member_appointments (
        member_profile_id, property_id, service_type, scheduled_at, status,
        technician_name, notes, completed_at, provider, external_id,
        provenance_state, verification_state, match_state,
        matched_obligation_id, source_observed_at, source_payload_hash,
        jobber_visit_classification_id, jobber_connection_id,
        jobber_projection_id, jobber_property_link_id, jobber_membership_id,
        jobber_authority_state, jobber_property_link_updated_at
      ) values (
        profile_id, membership_row.property_id, requested_service_type,
        projection_row.scheduled_start, 'scheduled', null, null, null,
        'jobber', projection_row.external_visit_id, 'provider_imported',
        'verified', 'matched', null, projection_row.source_observed_at,
        projection_row.source_payload_hash, classification_row.id,
        projection_row.connection_id, projection_row.id, link_row.id,
        membership_row.id, 'approved', link_row.updated_at
      ) returning * into appointment_row;
    else
      update public.member_appointments
      set service_type = requested_service_type,
          scheduled_at = projection_row.scheduled_start,
          verification_state = 'verified',
          match_state = 'matched',
          source_observed_at = projection_row.source_observed_at,
          source_payload_hash = projection_row.source_payload_hash,
          jobber_authority_state = 'approved',
          jobber_property_link_updated_at = link_row.updated_at
      where id = appointment_row.id
      returning * into appointment_row;
    end if;

    update public.jobber_visit_classifications
    set classification_state = 'approved', appointment_id = appointment_row.id,
        approved_at = changed_at, rejected_at = null, revoked_at = null,
        updated_at = changed_at
    where id = classification_row.id
    returning * into classification_row;
  else
    if classification_row.appointment_id is not null then
      update public.member_appointments
      set verification_state = 'rejected', match_state = 'ignored',
          jobber_authority_state = 'rejected'
      where id = classification_row.appointment_id
        and provider = 'jobber'
        and external_id = projection_row.external_visit_id
        and member_profile_id = profile_id
        and property_id = membership_row.property_id
        and provenance_state = 'provider_imported'
        and jobber_visit_classification_id = classification_row.id
        and jobber_connection_id = projection_row.connection_id
        and jobber_projection_id = projection_row.id
        and jobber_property_link_id = link_row.id
        and jobber_membership_id = membership_row.id
        and jobber_property_link_updated_at = link_row.updated_at
        and source_payload_hash = projection_row.source_payload_hash
        and source_observed_at = projection_row.source_observed_at
        and matched_obligation_id is null
        and status = 'scheduled'
        and completed_at is null;
      if not found then
        raise exception 'classification_conflict: Appointment ownership changed before rejection';
      end if;
    end if;
    update public.jobber_visit_classifications
    set classification_state = 'rejected', rejected_at = changed_at,
        approved_at = null, revoked_at = null,
        appointment_id = classification_row.appointment_id,
        updated_at = changed_at
    where id = classification_row.id
    returning * into classification_row;
  end if;

  insert into public.jobber_visit_classification_events (
    classification_id, event_type, actor_id, reason, projection_id,
    connection_id, external_visit_id, source_payload_hash,
    source_observed_at, external_property_id, property_link_id,
    property_link_updated_at, membership_id, property_id, service_type,
    scheduled_start, appointment_id, projection_snapshot, occurred_at
  ) values (
    classification_row.id,
    case when is_approval then 'approved' else 'rejected' end,
    requested_actor_id, pg_catalog.btrim(requested_reason), projection_row.id,
    projection_row.connection_id, projection_row.external_visit_id,
    projection_row.source_payload_hash, projection_row.source_observed_at,
    projection_row.external_property_id, link_row.id, link_row.updated_at,
    membership_row.id, membership_row.property_id, requested_service_type,
    projection_row.scheduled_start, classification_row.appointment_id,
    snapshot, changed_at
  );

  return pg_catalog.jsonb_build_object(
    'outcome', case when is_approval then 'approved' else 'rejected' end,
    'classification_id', classification_row.id,
    'appointment_id', classification_row.appointment_id
  );
end;
$$;

create or replace function public.revoke_jobber_visit_classification(
  requested_classification_id uuid,
  requested_expected_updated_at timestamptz,
  requested_reason text,
  requested_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  actor_row public.hq_admin_users%rowtype;
  classification_row public.jobber_visit_classifications%rowtype;
  appointment_row public.member_appointments%rowtype;
begin
  if requested_classification_id is null
    or requested_expected_updated_at is null
    or requested_actor_id is null
    or nullif(pg_catalog.btrim(coalesce(requested_reason, '')), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(requested_reason)) > 1000
  then
    raise exception 'classification_invalid: invalid revocation input';
  end if;
  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'classification_conflict: Headquarters actor is not active';
  end if;
  changed_at := pg_catalog.clock_timestamp();

  select * into classification_row
  from public.jobber_visit_classifications classification
  where classification.id = requested_classification_id
  for update;
  if not found then
    raise exception 'classification_not_found: Visit classification was not found';
  end if;
  if classification_row.classification_state = 'revoked'
    and classification_row.decision_actor_id = requested_actor_id
    and classification_row.decision_reason = pg_catalog.btrim(requested_reason)
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'replay', 'classification_id', classification_row.id,
      'appointment_id', classification_row.appointment_id
    );
  end if;
  if classification_row.updated_at <> requested_expected_updated_at
    or classification_row.classification_state <> 'approved'
  then
    raise exception 'classification_conflict: Visit classification changed while under review';
  end if;

  select * into appointment_row
  from public.member_appointments appointment
  where appointment.id = classification_row.appointment_id
  for update;
  if not found
    or appointment_row.provider is distinct from 'jobber'
    or appointment_row.external_id is distinct from classification_row.external_visit_id
    or appointment_row.property_id is distinct from classification_row.property_id
    or appointment_row.service_type is distinct from classification_row.service_type
    or appointment_row.scheduled_at is distinct from classification_row.scheduled_start
    or appointment_row.provenance_state is distinct from 'provider_imported'
    or appointment_row.jobber_visit_classification_id is distinct from classification_row.id
    or appointment_row.jobber_connection_id is distinct from classification_row.connection_id
    or appointment_row.jobber_projection_id is distinct from classification_row.projection_id
    or appointment_row.jobber_property_link_id is distinct from classification_row.property_link_id
    or appointment_row.jobber_membership_id is distinct from classification_row.membership_id
    or appointment_row.jobber_property_link_updated_at is distinct from classification_row.property_link_updated_at
    or appointment_row.source_payload_hash is distinct from classification_row.source_payload_hash
    or appointment_row.source_observed_at is distinct from classification_row.source_observed_at
    or appointment_row.jobber_authority_state is distinct from 'approved'
    or appointment_row.matched_obligation_id is not null
    or appointment_row.status is distinct from 'scheduled'
    or appointment_row.completed_at is not null
    or not exists (
      select 1
      from public.member_profiles profile
      join public.memberships membership
        on membership.id = classification_row.membership_id
       and membership.property_id = classification_row.property_id
       and membership.homeowner_id = profile.homeowner_id
      where profile.id = appointment_row.member_profile_id
    )
  then
    raise exception 'classification_conflict: Appointment ownership changed before revocation';
  end if;

  update public.jobber_visit_classifications
  set classification_state = 'revoked', decision_actor_id = requested_actor_id,
      decision_reason = pg_catalog.btrim(requested_reason), decided_at = changed_at,
      revoked_at = changed_at, updated_at = changed_at
  where id = classification_row.id
  returning * into classification_row;

  update public.member_appointments
  set verification_state = 'pending_review', match_state = 'manual_review',
      jobber_authority_state = 'revoked'
  where id = appointment_row.id;

  insert into public.jobber_visit_classification_events (
    classification_id, event_type, actor_id, reason, projection_id,
    connection_id, external_visit_id, source_payload_hash,
    source_observed_at, external_property_id, property_link_id,
    property_link_updated_at, membership_id, property_id, service_type,
    scheduled_start, appointment_id, projection_snapshot, occurred_at
  ) values (
    classification_row.id, 'revoked', requested_actor_id,
    pg_catalog.btrim(requested_reason), classification_row.projection_id,
    classification_row.connection_id, classification_row.external_visit_id,
    classification_row.source_payload_hash, classification_row.source_observed_at,
    classification_row.external_property_id, classification_row.property_link_id,
    classification_row.property_link_updated_at, classification_row.membership_id,
    classification_row.property_id, classification_row.service_type,
    classification_row.scheduled_start, classification_row.appointment_id,
    classification_row.projection_snapshot, changed_at
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'revoked', 'classification_id', classification_row.id,
    'appointment_id', classification_row.appointment_id
  );
end;
$$;

create or replace function public.invalidate_jobber_visit_classification_on_source_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  classification_row public.jobber_visit_classifications%rowtype;
begin
  if old.source_payload_hash is not distinct from new.source_payload_hash then
    return new;
  end if;
  for classification_row in
    select * from public.jobber_visit_classifications classification
    where classification.projection_id = old.id
      and classification.source_payload_hash = old.source_payload_hash
      and classification.classification_state = 'approved'
    for update
  loop
    update public.jobber_visit_classifications
    set classification_state = 'pending_review', updated_at = pg_catalog.clock_timestamp()
    where id = classification_row.id;
    update public.member_appointments
    set verification_state = 'pending_review', match_state = 'manual_review',
        jobber_authority_state = 'pending_review'
    where id = classification_row.appointment_id;
    insert into public.jobber_visit_classification_events (
      classification_id, event_type, actor_id, reason, projection_id,
      connection_id, external_visit_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      scheduled_start, appointment_id, projection_snapshot
    ) values (
      classification_row.id, 'source_invalidated', null,
      'Coverage sync observed a changed source hash; reapproval is required',
      classification_row.projection_id, classification_row.connection_id,
      classification_row.external_visit_id, classification_row.source_payload_hash,
      classification_row.source_observed_at, classification_row.external_property_id,
      classification_row.property_link_id, classification_row.property_link_updated_at,
      classification_row.membership_id, classification_row.property_id,
      classification_row.service_type, classification_row.scheduled_start,
      classification_row.appointment_id, classification_row.projection_snapshot
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists jobber_visit_classifications_source_fence
  on public.jobber_visit_projections;
create trigger jobber_visit_classifications_source_fence
  after update of source_payload_hash on public.jobber_visit_projections
  for each row execute function public.invalidate_jobber_visit_classification_on_source_change();

create or replace function public.invalidate_jobber_visit_classification_on_link_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  classification_row public.jobber_visit_classifications%rowtype;
begin
  if old.updated_at is not distinct from new.updated_at then
    return new;
  end if;
  for classification_row in
    select * from public.jobber_visit_classifications classification
    where classification.property_link_id = old.id
      and classification.property_link_updated_at = old.updated_at
      and classification.classification_state = 'approved'
    for update
  loop
    update public.jobber_visit_classifications
    set classification_state = 'pending_review', updated_at = pg_catalog.clock_timestamp()
    where id = classification_row.id;
    update public.member_appointments
    set verification_state = 'pending_review', match_state = 'manual_review',
        jobber_authority_state = 'pending_review'
    where id = classification_row.appointment_id;
    insert into public.jobber_visit_classification_events (
      classification_id, event_type, actor_id, reason, projection_id,
      connection_id, external_visit_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      scheduled_start, appointment_id, projection_snapshot
    ) values (
      classification_row.id, 'property_link_invalidated', null,
      'The reviewed property-link token changed; reapproval is required',
      classification_row.projection_id, classification_row.connection_id,
      classification_row.external_visit_id, classification_row.source_payload_hash,
      classification_row.source_observed_at, classification_row.external_property_id,
      classification_row.property_link_id, classification_row.property_link_updated_at,
      classification_row.membership_id, classification_row.property_id,
      classification_row.service_type, classification_row.scheduled_start,
      classification_row.appointment_id, classification_row.projection_snapshot
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists jobber_visit_classifications_link_fence
  on public.jobber_property_links;
create trigger jobber_visit_classifications_link_fence
  after update on public.jobber_property_links
  for each row execute function public.invalidate_jobber_visit_classification_on_link_change();

create or replace function public.invalidate_jobber_visit_classification_on_manifest_omission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  classification_row public.jobber_visit_classifications%rowtype;
begin
  if new.status <> 'complete'
    or old.status = 'complete'
    or new.completed_at is null
    or not exists (
      select 1
      from public.jobber_schedule_sync_watermarks watermark
      where watermark.connection_id = new.connection_id
        and watermark.run_id = new.id
        and watermark.window_start = new.window_start
        and watermark.window_end = new.window_end
        and watermark.covered_at = new.completed_at
        and watermark.generation = new.expected_watermark_generation + 1
    )
  then
    return new;
  end if;

  for classification_row in
    select classification.*
    from public.jobber_visit_classifications classification
    join public.jobber_visit_projections projection
      on projection.id = classification.projection_id
     and projection.connection_id = classification.connection_id
     and projection.external_visit_id = classification.external_visit_id
    where classification.connection_id = new.connection_id
      and classification.classification_state = 'approved'
      and not exists (
        select 1
        from public.jobber_visit_source_observations observation
        where observation.run_id = new.id
          and observation.pass_number = 2
          and observation.external_visit_id = classification.external_visit_id
      )
    for update of classification
  loop
    update public.jobber_visit_classifications
    set classification_state = 'pending_review', updated_at = changed_at
    where id = classification_row.id;
    update public.member_appointments
    set verification_state = 'pending_review', match_state = 'manual_review',
        jobber_authority_state = 'pending_review'
    where id = classification_row.appointment_id
      and jobber_visit_classification_id = classification_row.id;
    insert into public.jobber_visit_classification_events (
      classification_id, event_type, actor_id, reason, projection_id,
      connection_id, external_visit_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      scheduled_start, appointment_id, projection_snapshot, occurred_at
    ) values (
      classification_row.id, 'manifest_omission_invalidated', null,
      'A later complete coverage manifest omitted this exact visit; authority is pending review without inferring cancellation or deletion',
      classification_row.projection_id, classification_row.connection_id,
      classification_row.external_visit_id, classification_row.source_payload_hash,
      classification_row.source_observed_at, classification_row.external_property_id,
      classification_row.property_link_id, classification_row.property_link_updated_at,
      classification_row.membership_id, classification_row.property_id,
      classification_row.service_type, classification_row.scheduled_start,
      classification_row.appointment_id, classification_row.projection_snapshot,
      changed_at
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists jobber_visit_classifications_manifest_fence
  on public.jobber_schedule_sync_runs;
create trigger jobber_visit_classifications_manifest_fence
  after update of status on public.jobber_schedule_sync_runs
  for each row execute function public.invalidate_jobber_visit_classification_on_manifest_omission();

alter table public.jobber_visit_classifications enable row level security;
alter table public.jobber_visit_classification_events enable row level security;

revoke all on sequence public.jobber_schedule_sync_reservation_sequence
from public, anon, authenticated, service_role;

revoke all on table public.jobber_visit_classifications,
  public.jobber_visit_classification_events
from public, anon, authenticated, service_role;
grant select on table public.jobber_visit_classifications,
  public.jobber_visit_classification_events
to service_role;

-- The old Phase-1 anon appointment policy would permit forged authority flags.
drop policy if exists "member_appointments_anon_all" on public.member_appointments;
alter table public.member_appointments enable row level security;
revoke all on table public.member_appointments
from public, anon, authenticated, service_role;
grant select, insert, update on table public.member_appointments to service_role;

revoke all on function public.decide_jobber_visit_classification(
  text, uuid, text, uuid, timestamptz, uuid, uuid, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.revoke_jobber_visit_classification(
  uuid, timestamptz, text, uuid
) from public, anon, authenticated;
revoke all on function public.reject_jobber_visit_classification_event_change()
from public, anon, authenticated, service_role;
revoke all on function public.reject_jobber_visit_classification_delete()
from public, anon, authenticated, service_role;
revoke all on function public.invalidate_jobber_visit_classification_on_source_change()
from public, anon, authenticated, service_role;
revoke all on function public.invalidate_jobber_visit_classification_on_link_change()
from public, anon, authenticated, service_role;
revoke all on function public.invalidate_jobber_visit_classification_on_manifest_omission()
from public, anon, authenticated, service_role;

grant execute on function public.decide_jobber_visit_classification(
  text, uuid, text, uuid, timestamptz, uuid, uuid, text, text, uuid
) to service_role;
grant execute on function public.revoke_jobber_visit_classification(
  uuid, timestamptz, text, uuid
) to service_role;

comment on table public.jobber_visit_classifications is
  'Current supervised per-visit authority. Source, property-link, or current complete-manifest invalidation immediately removes appointment authority.';
comment on table public.jobber_visit_classification_events is
  'Immutable approved, rejected, revoked, and invalidated visit-classification evidence.';
