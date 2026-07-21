-- Resumable, bounded Jobber schedule coverage verification.
--
-- This migration preserves migration 038's immutable leaves, observations,
-- two-pass comparison, projection finalizer, and watermark CAS. It adds only
-- durable temporal-partition frontier state and immutable provider-attempt
-- reservations. It narrows migration 039's existing manifest-omission trigger
-- to the completed half-open window and makes its classification, appointment,
-- and event changes fail-closed and atomic. Whether any such transitive write
-- is allowed remains an unresolved product-policy decision.

begin;

alter table public.jobber_schedule_sync_runs
  add column if not exists continuation_paused_at timestamptz;

alter table public.jobber_schedule_sync_locks
  add column if not exists acquisition_generation bigint not null default 0,
  add column if not exists owner_token uuid;

-- Fence any pre-045 active worker at migration time. Its generated token is
-- intentionally undisclosed; after lease expiry the resumable acquisition
-- path replays its unfinished work under a new generation and token.
update public.jobber_schedule_sync_locks
set acquisition_generation = greatest(acquisition_generation, 1::bigint),
    owner_token = coalesce(owner_token, pg_catalog.gen_random_uuid())
where active_run_id is not null
  and (acquisition_generation = 0 or owner_token is null);

alter table public.jobber_schedule_sync_locks
  drop constraint if exists jobber_schedule_sync_locks_check,
  drop constraint if exists jobber_schedule_sync_locks_045_owner_check;

alter table public.jobber_schedule_sync_locks
  add constraint jobber_schedule_sync_locks_045_owner_check check (
    acquisition_generation >= 0
    and (
      (acquisition_generation = 0 and owner_token is null)
      or (acquisition_generation > 0 and owner_token is not null)
    )
    and (
      (active_run_id is null and acquired_at is null and lease_expires_at is null)
      or (
        active_run_id is not null
        and acquired_at is not null
        and lease_expires_at is not null
        and acquisition_generation > 0
        and owner_token is not null
      )
    )
  );

alter table public.jobber_schedule_sync_runs
  drop constraint if exists jobber_schedule_sync_runs_status_check,
  drop constraint if exists jobber_schedule_sync_runs_check1,
  drop constraint if exists jobber_schedule_sync_runs_045_status_check,
  drop constraint if exists jobber_schedule_sync_runs_045_lifecycle_check;

alter table public.jobber_schedule_sync_runs
  add constraint jobber_schedule_sync_runs_045_status_check check (
    status in ('running', 'awaiting_continuation', 'complete', 'partial')
  ),
  add constraint jobber_schedule_sync_runs_045_lifecycle_check check (
    (
      status in ('running', 'awaiting_continuation')
      and completed_at is null
      and failure_code is null
    ) or (
      status = 'complete'
      and completed_at is not null
      and failure_code is null
    ) or (
      status = 'partial'
      and completed_at is not null
      and failure_code is not null
    )
  );

create table if not exists public.jobber_schedule_sync_work_items (
  run_id uuid not null
    constraint jobber_schedule_sync_work_items_run_fk
    references public.jobber_schedule_sync_runs(id) on delete restrict,
  pass_number smallint not null
    constraint jobber_schedule_sync_work_items_pass_check
    check (pass_number in (1, 2)),
  partition_path text not null
    constraint jobber_schedule_sync_work_items_path_check check (
    partition_path ~ '^r[01]*$'
    and pg_catalog.char_length(partition_path) <= 128
  ),
  window_start timestamptz not null,
  window_end timestamptz not null,
  work_state text not null
    constraint jobber_schedule_sync_work_items_state_check check (
    work_state in ('pending', 'in_progress', 'overflow', 'complete')
  ),
  attempt_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint jobber_schedule_sync_work_items_pkey
    primary key (run_id, pass_number, partition_path),
  constraint jobber_schedule_sync_work_items_window_key
    unique (run_id, pass_number, window_start, window_end),
  constraint jobber_schedule_sync_work_items_window_check
    check (window_start < window_end),
  constraint jobber_schedule_sync_work_items_attempt_check check (
    (work_state = 'pending' and attempt_id is null)
    or (work_state <> 'pending' and attempt_id is not null)
  )
);

create index if not exists jobber_schedule_sync_work_items_frontier_idx
  on public.jobber_schedule_sync_work_items(
    run_id, pass_number, work_state, partition_path
  );

create table if not exists public.jobber_schedule_sync_request_attempts (
  id uuid constraint jobber_schedule_sync_request_attempts_pkey primary key,
  run_id uuid not null,
  pass_number smallint not null,
  partition_path text not null,
  actor_id uuid not null
    constraint jobber_schedule_sync_request_attempts_actor_fk
    references public.hq_admin_users(user_id) on delete restrict,
  acquisition_generation bigint not null
    constraint jobber_schedule_sync_request_attempts_generation_check
    check (acquisition_generation > 0),
  owner_token uuid not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  reserved_at timestamptz not null default pg_catalog.now(),
  constraint jobber_schedule_sync_request_attempts_work_fk
    foreign key (run_id, pass_number, partition_path)
    references public.jobber_schedule_sync_work_items(
      run_id, pass_number, partition_path
    ) on delete restrict,
  constraint jobber_schedule_sync_request_attempts_window_check
    check (window_start < window_end)
);

create index if not exists jobber_schedule_sync_request_attempts_run_idx
  on public.jobber_schedule_sync_request_attempts(
    run_id, pass_number, partition_path, reserved_at
  );

-- A pre-045 running row has no deterministic frontier to resume. Preserve its
-- evidence as terminal storage failure and release only its exact lock; every
-- run acquired after this migration receives a root work item atomically.
update public.jobber_schedule_sync_runs run
set status = 'partial', failure_code = 'storage_failure',
    completed_at = pg_catalog.clock_timestamp()
where run.status = 'running'
  and not exists (
    select 1 from public.jobber_schedule_sync_work_items work
    where work.run_id = run.id
  );

update public.jobber_schedule_sync_locks sync_lock
set active_run_id = null, acquired_at = null, lease_expires_at = null
where sync_lock.active_run_id is not null
  and exists (
    select 1 from public.jobber_schedule_sync_runs run
    where run.id = sync_lock.active_run_id
      and run.status = 'partial'
      and run.failure_code = 'storage_failure'
  );

create or replace function public.reject_jobber_schedule_sync_attempt_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber schedule sync request attempts are append-only and immutable';
end;
$$;

drop trigger if exists jobber_schedule_sync_request_attempts_immutable
  on public.jobber_schedule_sync_request_attempts;
create trigger jobber_schedule_sync_request_attempts_immutable
  before update or delete on public.jobber_schedule_sync_request_attempts
  for each row execute function public.reject_jobber_schedule_sync_attempt_change();

create or replace function public.reject_jobber_schedule_sync_work_item_delete()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber schedule sync frontier rows cannot be deleted';
end;
$$;

drop trigger if exists jobber_schedule_sync_work_items_no_delete
  on public.jobber_schedule_sync_work_items;
create trigger jobber_schedule_sync_work_items_no_delete
  before delete on public.jobber_schedule_sync_work_items
  for each row execute function public.reject_jobber_schedule_sync_work_item_delete();

create or replace function public.invalidate_jobber_visit_classification_on_manifest_omission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  classification_row public.jobber_visit_classifications%rowtype;
  classification_count integer;
  appointment_count integer;
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
      and classification.scheduled_start >= new.window_start
      and classification.scheduled_start < new.window_end
      and not exists (
        select 1
        from public.jobber_visit_source_observations observation
        where observation.run_id = new.id
          and observation.pass_number = 2
          and observation.external_visit_id = classification.external_visit_id
      )
    order by classification.id
    for update of classification
  loop
    update public.jobber_visit_classifications
    set classification_state = 'pending_review', updated_at = changed_at
    where id = classification_row.id
      and classification_state = 'approved';
    get diagnostics classification_count = row_count;
    if classification_count <> 1 then
      raise exception 'manifest_omission_binding_conflict: expected exactly one approved classification';
    end if;

    update public.member_appointments appointment
    set verification_state = 'pending_review', match_state = 'manual_review',
        jobber_authority_state = 'pending_review'
    where appointment.id = classification_row.appointment_id
      and appointment.provider is not distinct from 'jobber'
      and appointment.external_id is not distinct from classification_row.external_visit_id
      and appointment.property_id is not distinct from classification_row.property_id
      and appointment.service_type is not distinct from classification_row.service_type
      and appointment.scheduled_at is not distinct from classification_row.scheduled_start
      and appointment.provenance_state is not distinct from 'provider_imported'
      and appointment.jobber_visit_classification_id is not distinct from classification_row.id
      and appointment.jobber_connection_id is not distinct from classification_row.connection_id
      and appointment.jobber_projection_id is not distinct from classification_row.projection_id
      and appointment.jobber_property_link_id is not distinct from classification_row.property_link_id
      and appointment.jobber_membership_id is not distinct from classification_row.membership_id
      and appointment.jobber_property_link_updated_at is not distinct from classification_row.property_link_updated_at
      and appointment.source_payload_hash is not distinct from classification_row.source_payload_hash
      and appointment.source_observed_at is not distinct from classification_row.source_observed_at
      and appointment.jobber_authority_state is not distinct from 'approved'
      and appointment.matched_obligation_id is null
      and appointment.status is not distinct from 'scheduled'
      and appointment.completed_at is null;
    get diagnostics appointment_count = row_count;
    if appointment_count <> 1 then
      raise exception 'manifest_omission_binding_conflict: expected exactly one bound authoritative appointment';
    end if;

    insert into public.jobber_visit_classification_events (
      classification_id, event_type, actor_id, reason, projection_id,
      connection_id, external_visit_id, source_payload_hash,
      source_observed_at, external_property_id, property_link_id,
      property_link_updated_at, membership_id, property_id, service_type,
      scheduled_start, appointment_id, projection_snapshot, occurred_at
    ) values (
      classification_row.id, 'manifest_omission_invalidated', null,
      'A later complete coverage manifest omitted this in-window visit; authority is pending review without inferring cancellation, deletion, or completion',
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

create or replace function public.assert_resumable_jobber_schedule_sync_owner(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  run_connection_id text;
begin
  if requested_run_id is null
    or requested_actor_id is null
    or requested_acquisition_generation is null
    or requested_acquisition_generation < 1
    or requested_owner_token is null
  then
    raise exception 'Invalid Jobber schedule sync ownership fence';
  end if;

  perform 1
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'Jobber schedule sync actor is not active';
  end if;

  select run.connection_id into run_connection_id
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id;
  if not found then
    raise exception 'Jobber schedule sync run was not found';
  end if;

  perform 1
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = run_connection_id
    and sync_lock.active_run_id = requested_run_id
    and sync_lock.acquisition_generation = requested_acquisition_generation
    and sync_lock.owner_token = requested_owner_token
    and sync_lock.lease_expires_at > changed_at
  for update;
  if not found then
    raise exception 'Jobber schedule sync ownership fence was lost';
  end if;

  perform 1
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
    and run.connection_id = run_connection_id
    and run.status = 'running'
  for update;
  if not found then
    raise exception 'Jobber schedule sync run is not active';
  end if;

  return run_connection_id;
end;
$$;

create or replace function public.start_or_resume_jobber_schedule_coverage_sync(
  requested_proposed_run_id uuid,
  requested_connection_id text,
  requested_actor_id uuid,
  requested_window_start timestamptz,
  requested_window_end timestamptz,
  requested_graphql_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  lock_row public.jobber_schedule_sync_locks%rowtype;
  active_run public.jobber_schedule_sync_runs%rowtype;
  resumable_run public.jobber_schedule_sync_runs%rowtype;
  selected_run public.jobber_schedule_sync_runs%rowtype;
  watermark_generation bigint := 0;
  selected_pass smallint;
  pass_ready boolean := false;
  result_outcome text;
begin
  if requested_proposed_run_id is null
    or nullif(pg_catalog.btrim(coalesce(requested_connection_id, '')), '') is null
    or requested_actor_id is null
    or requested_window_start is null
    or requested_window_end is null
    or requested_window_start >= requested_window_end
    or nullif(pg_catalog.btrim(coalesce(requested_graphql_version, '')), '') is null
  then
    raise exception 'Invalid resumable Jobber schedule sync reservation input';
  end if;

  perform 1
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'Jobber schedule sync actor is not active';
  end if;

  perform 1
  from public.jobber_connections connection
  where connection.id = requested_connection_id
    and connection.status = 'connected'
    and connection.graphql_version = requested_graphql_version
  for share;
  if not found then
    raise exception 'Jobber connection or pinned version is unavailable';
  end if;

  insert into public.jobber_schedule_sync_locks (connection_id)
  values (requested_connection_id)
  on conflict (connection_id) do nothing;

  select * into lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = requested_connection_id
  for update;

  if lock_row.active_run_id is not null then
    select * into active_run
    from public.jobber_schedule_sync_runs run
    where run.id = lock_row.active_run_id
    for update;
    if not found then
      raise exception 'Jobber schedule sync lock references a missing run';
    end if;

    if lock_row.lease_expires_at > changed_at
      and active_run.status = 'running'
    then
      selected_pass := case
        when active_run.pass_one_manifest_sha256 is null then 1 else 2
      end;
      return pg_catalog.jsonb_build_object(
        'outcome', 'locked',
        'run_id', active_run.id,
        'watermark_generation', active_run.expected_watermark_generation,
        'window_start', active_run.window_start,
        'window_end', active_run.window_end,
        'current_pass', selected_pass,
        'pass_ready_to_complete', false,
        'request_count', active_run.request_count,
        'leaf_count', active_run.leaf_count,
        'visit_count', active_run.visit_count
      );
    end if;

    if active_run.status = 'running' then
      update public.jobber_schedule_sync_runs
      set status = 'awaiting_continuation',
          continuation_paused_at = changed_at
      where id = active_run.id;
      update public.jobber_schedule_sync_work_items
      set work_state = 'pending', attempt_id = null, updated_at = changed_at
      where run_id = active_run.id
        and work_state = 'in_progress';
    end if;

    update public.jobber_schedule_sync_locks
    set active_run_id = null, acquired_at = null, lease_expires_at = null
    where connection_id = requested_connection_id;
  end if;

  select coalesce(watermark.generation, 0)
  into watermark_generation
  from public.jobber_schedule_sync_watermarks watermark
  where watermark.connection_id = requested_connection_id;
  watermark_generation := coalesce(watermark_generation, 0);

  select * into resumable_run
  from public.jobber_schedule_sync_runs run
  where run.connection_id = requested_connection_id
    and run.status = 'awaiting_continuation'
  order by run.reservation_sequence desc
  limit 1
  for update;

  if found and (
    resumable_run.graphql_version <> requested_graphql_version
    or resumable_run.expected_watermark_generation <> watermark_generation
  ) then
    update public.jobber_schedule_sync_runs
    set status = 'partial',
        failure_code = case
          when resumable_run.graphql_version <> requested_graphql_version
            then 'version_mismatch'
          else 'watermark_conflict'
        end,
        completed_at = changed_at
    where id = resumable_run.id;
    resumable_run.id := null;
  end if;

  if resumable_run.id is not null then
    update public.jobber_schedule_sync_work_items
    set work_state = 'pending', attempt_id = null, updated_at = changed_at
    where run_id = resumable_run.id
      and work_state = 'in_progress';
    update public.jobber_schedule_sync_runs
    set status = 'running', continuation_paused_at = null
    where id = resumable_run.id
    returning * into selected_run;
    result_outcome := 'resumed';
  else
    insert into public.jobber_schedule_sync_runs (
      id, connection_id, actor_id, window_start, window_end,
      graphql_version, expected_watermark_generation
    ) values (
      requested_proposed_run_id, requested_connection_id, requested_actor_id,
      requested_window_start, requested_window_end, requested_graphql_version,
      watermark_generation
    )
    returning * into selected_run;
    insert into public.jobber_schedule_sync_work_items (
      run_id, pass_number, partition_path, window_start, window_end, work_state
    ) values (
      selected_run.id, 1, 'r', selected_run.window_start,
      selected_run.window_end, 'pending'
    );
    result_outcome := 'started';
  end if;

  update public.jobber_schedule_sync_locks
  set active_run_id = selected_run.id,
      acquired_at = changed_at,
      lease_expires_at = changed_at + pg_catalog.make_interval(mins => 10),
      acquisition_generation = acquisition_generation + 1,
      owner_token = pg_catalog.gen_random_uuid()
  where connection_id = requested_connection_id
  returning * into lock_row;

  selected_pass := case
    when selected_run.pass_one_manifest_sha256 is null then 1 else 2
  end;
  select
    exists (
      select 1
      from public.jobber_schedule_sync_work_items work
      where work.run_id = selected_run.id
        and work.pass_number = selected_pass
        and work.work_state = 'complete'
    ) and not exists (
      select 1
      from public.jobber_schedule_sync_work_items work
      where work.run_id = selected_run.id
        and work.pass_number = selected_pass
        and work.work_state in ('pending', 'in_progress')
    )
  into pass_ready;

  return pg_catalog.jsonb_build_object(
    'outcome', result_outcome,
    'run_id', selected_run.id,
    'acquisition_generation', lock_row.acquisition_generation,
    'owner_token', lock_row.owner_token,
    'watermark_generation', selected_run.expected_watermark_generation,
    'window_start', selected_run.window_start,
    'window_end', selected_run.window_end,
    'current_pass', selected_pass,
    'pass_ready_to_complete', pass_ready,
    'request_count', selected_run.request_count,
    'leaf_count', selected_run.leaf_count,
    'visit_count', selected_run.visit_count
  );
end;
$$;

create or replace function public.renew_resumable_jobber_schedule_coverage_sync_lease(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );
  perform public.renew_jobber_schedule_coverage_sync_lease(requested_run_id);
end;
$$;

create or replace function public.reserve_jobber_schedule_coverage_attempt(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  run_row public.jobber_schedule_sync_runs%rowtype;
  work_row public.jobber_schedule_sync_work_items%rowtype;
  attempt_row public.jobber_schedule_sync_request_attempts%rowtype;
  current_pass smallint;
begin
  if requested_run_id is null
    or requested_actor_id is null
    or requested_attempt_id is null
  then
    raise exception 'Invalid Jobber coverage attempt reservation input';
  end if;

  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  select * into attempt_row
  from public.jobber_schedule_sync_request_attempts attempt
  where attempt.id = requested_attempt_id;
  if found then
    if attempt_row.run_id <> requested_run_id
      or attempt_row.actor_id <> requested_actor_id
      or attempt_row.acquisition_generation <> requested_acquisition_generation
      or attempt_row.owner_token <> requested_owner_token
      or not exists (
        select 1
        from public.jobber_schedule_sync_work_items work
        where work.run_id = attempt_row.run_id
          and work.pass_number = attempt_row.pass_number
          and work.partition_path = attempt_row.partition_path
          and work.work_state = 'in_progress'
          and work.attempt_id = attempt_row.id
      )
    then
      raise exception 'Jobber coverage attempt replay did not match';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'reserved', 'attempt_id', attempt_row.id,
      'pass_number', attempt_row.pass_number,
      'partition_path', attempt_row.partition_path,
      'window_start', attempt_row.window_start,
      'window_end', attempt_row.window_end
    );
  end if;

  current_pass := case
    when run_row.pass_one_manifest_sha256 is null then 1 else 2
  end;
  select * into work_row
  from public.jobber_schedule_sync_work_items work
  where work.run_id = requested_run_id
    and work.pass_number = current_pass
    and work.work_state = 'pending'
  order by work.partition_path
  limit 1
  for update;
  if not found then
    raise exception 'Jobber coverage frontier is ready for pass completion';
  end if;

  insert into public.jobber_schedule_sync_request_attempts (
    id, run_id, pass_number, partition_path, actor_id,
    acquisition_generation, owner_token,
    window_start, window_end, reserved_at
  ) values (
    requested_attempt_id, requested_run_id, work_row.pass_number,
    work_row.partition_path, requested_actor_id,
    requested_acquisition_generation, requested_owner_token, work_row.window_start,
    work_row.window_end, changed_at
  );
  update public.jobber_schedule_sync_work_items
  set work_state = 'in_progress', attempt_id = requested_attempt_id,
      updated_at = changed_at
  where run_id = work_row.run_id
    and pass_number = work_row.pass_number
    and partition_path = work_row.partition_path;
  update public.jobber_schedule_sync_runs
  set request_count = request_count + 1
  where id = requested_run_id;
  update public.jobber_schedule_sync_locks
  set lease_expires_at = changed_at + pg_catalog.make_interval(mins => 10)
  where connection_id = run_row.connection_id
    and active_run_id = run_row.id
    and acquisition_generation = requested_acquisition_generation
    and owner_token = requested_owner_token;
  if not found then
    raise exception 'Jobber schedule sync ownership fence was lost';
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'reserved', 'attempt_id', requested_attempt_id,
    'pass_number', work_row.pass_number,
    'partition_path', work_row.partition_path,
    'window_start', work_row.window_start,
    'window_end', work_row.window_end
  );
end;
$$;

create or replace function public.record_jobber_schedule_coverage_overflow(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_attempt_id uuid,
  requested_left_start timestamptz,
  requested_left_end timestamptz,
  requested_right_start timestamptz,
  requested_right_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  run_row public.jobber_schedule_sync_runs%rowtype;
  attempt_row public.jobber_schedule_sync_request_attempts%rowtype;
  work_row public.jobber_schedule_sync_work_items%rowtype;
  start_ms bigint;
  end_ms bigint;
  midpoint_ms bigint;
  expected_midpoint timestamptz;
begin
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  select * into attempt_row
  from public.jobber_schedule_sync_request_attempts attempt
  where attempt.id = requested_attempt_id;
  if not found
    or attempt_row.run_id <> requested_run_id
    or attempt_row.actor_id <> requested_actor_id
    or attempt_row.acquisition_generation <> requested_acquisition_generation
    or attempt_row.owner_token <> requested_owner_token
  then
    raise exception 'Jobber coverage overflow attempt did not match';
  end if;
  select * into work_row
  from public.jobber_schedule_sync_work_items work
  where work.run_id = attempt_row.run_id
    and work.pass_number = attempt_row.pass_number
    and work.partition_path = attempt_row.partition_path
  for update;
  if not found or work_row.attempt_id <> requested_attempt_id then
    raise exception 'Jobber coverage overflow work item changed';
  end if;

  start_ms := pg_catalog.floor(
    extract(epoch from work_row.window_start) * 1000
  )::bigint;
  end_ms := pg_catalog.floor(
    extract(epoch from work_row.window_end) * 1000
  )::bigint;
  if end_ms - start_ms <= 1 then
    raise exception 'Jobber coverage overflow was unsplittable';
  end if;
  midpoint_ms := start_ms + ((end_ms - start_ms) / 2);
  expected_midpoint := pg_catalog.to_timestamp(midpoint_ms::numeric / 1000);
  if requested_left_start <> work_row.window_start
    or requested_left_end <> expected_midpoint
    or requested_right_start <> expected_midpoint
    or requested_right_end <> work_row.window_end
  then
    raise exception 'Jobber coverage overflow split was not deterministic';
  end if;

  if work_row.work_state = 'overflow' then
    if not exists (
      select 1 from public.jobber_schedule_sync_work_items child
      where child.run_id = work_row.run_id
        and child.pass_number = work_row.pass_number
        and child.partition_path = work_row.partition_path || '0'
        and child.window_start = requested_left_start
        and child.window_end = requested_left_end
    ) or not exists (
      select 1 from public.jobber_schedule_sync_work_items child
      where child.run_id = work_row.run_id
        and child.pass_number = work_row.pass_number
        and child.partition_path = work_row.partition_path || '1'
        and child.window_start = requested_right_start
        and child.window_end = requested_right_end
    ) then
      raise exception 'Jobber coverage overflow replay did not match';
    end if;
    return;
  end if;
  if work_row.work_state <> 'in_progress' then
    raise exception 'Jobber coverage overflow work item is not in progress';
  end if;

  update public.jobber_schedule_sync_work_items
  set work_state = 'overflow', updated_at = changed_at
  where run_id = work_row.run_id
    and pass_number = work_row.pass_number
    and partition_path = work_row.partition_path;
  insert into public.jobber_schedule_sync_work_items (
    run_id, pass_number, partition_path, window_start, window_end, work_state
  ) values
    (
      work_row.run_id, work_row.pass_number, work_row.partition_path || '0',
      requested_left_start, requested_left_end, 'pending'
    ),
    (
      work_row.run_id, work_row.pass_number, work_row.partition_path || '1',
      requested_right_start, requested_right_end, 'pending'
    );
end;
$$;

create or replace function public.record_jobber_schedule_coverage_leaf(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_attempt_id uuid,
  requested_manifest_sha256 text,
  requested_observations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  run_row public.jobber_schedule_sync_runs%rowtype;
  attempt_row public.jobber_schedule_sync_request_attempts%rowtype;
  work_row public.jobber_schedule_sync_work_items%rowtype;
  partition_row public.jobber_schedule_sync_partitions%rowtype;
  next_leaf_index integer;
  pass_ready boolean;
begin
  if requested_manifest_sha256 is null
    or requested_manifest_sha256 !~ '^[0-9a-f]{64}$'
    or requested_observations is null
    or pg_catalog.jsonb_typeof(requested_observations) <> 'array'
  then
    raise exception 'Invalid Jobber coverage leaf checkpoint input';
  end if;
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  select * into attempt_row
  from public.jobber_schedule_sync_request_attempts attempt
  where attempt.id = requested_attempt_id;
  if not found
    or attempt_row.run_id <> requested_run_id
    or attempt_row.actor_id <> requested_actor_id
    or attempt_row.acquisition_generation <> requested_acquisition_generation
    or attempt_row.owner_token <> requested_owner_token
  then
    raise exception 'Jobber coverage leaf attempt did not match';
  end if;
  select * into work_row
  from public.jobber_schedule_sync_work_items work
  where work.run_id = attempt_row.run_id
    and work.pass_number = attempt_row.pass_number
    and work.partition_path = attempt_row.partition_path
  for update;
  if not found or work_row.attempt_id <> requested_attempt_id then
    raise exception 'Jobber coverage leaf work item changed';
  end if;

  if work_row.work_state = 'complete' then
    select * into partition_row
    from public.jobber_schedule_sync_partitions partition
    where partition.run_id = work_row.run_id
      and partition.pass_number = work_row.pass_number
      and partition.window_start = work_row.window_start
      and partition.window_end = work_row.window_end;
    if not found then
      raise exception 'Jobber coverage completed work omitted immutable evidence';
    end if;
    perform public.append_jobber_schedule_coverage_leaf(
      work_row.run_id, work_row.pass_number, partition_row.leaf_index,
      work_row.window_start, work_row.window_end,
      requested_manifest_sha256, requested_observations
    );
  else
    if work_row.work_state <> 'in_progress' then
      raise exception 'Jobber coverage leaf work item is not in progress';
    end if;
    select pg_catalog.count(*)::integer into next_leaf_index
    from public.jobber_schedule_sync_partitions partition
    where partition.run_id = work_row.run_id
      and partition.pass_number = work_row.pass_number;
    perform public.append_jobber_schedule_coverage_leaf(
      work_row.run_id, work_row.pass_number, next_leaf_index,
      work_row.window_start, work_row.window_end,
      requested_manifest_sha256, requested_observations
    );
    update public.jobber_schedule_sync_work_items
    set work_state = 'complete', updated_at = changed_at
    where run_id = work_row.run_id
      and pass_number = work_row.pass_number
      and partition_path = work_row.partition_path;
    if work_row.pass_number = 2 then
      update public.jobber_schedule_sync_runs
      set visit_count = visit_count + pg_catalog.jsonb_array_length(requested_observations)
      where id = work_row.run_id;
    end if;
  end if;

  select not exists (
    select 1
    from public.jobber_schedule_sync_work_items work
    where work.run_id = work_row.run_id
      and work.pass_number = work_row.pass_number
      and work.work_state in ('pending', 'in_progress')
  ) into pass_ready;
  return pg_catalog.jsonb_build_object(
    'pass_ready_to_complete', pass_ready
  );
end;
$$;

create or replace function public.complete_resumable_jobber_schedule_coverage_pass(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_pass smallint,
  requested_manifest_sha256 text,
  requested_leaf_coverage_sha256 text,
  requested_leaf_count integer,
  requested_visit_count integer,
  requested_request_count integer
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  run_row public.jobber_schedule_sync_runs%rowtype;
  stored_leaf_count integer;
  stored_visit_count integer;
  stored_request_count integer;
begin
  if requested_run_id is null
    or requested_actor_id is null
    or requested_pass not in (1, 2)
    or requested_manifest_sha256 !~ '^[0-9a-f]{64}$'
    or requested_leaf_coverage_sha256 !~ '^[0-9a-f]{64}$'
    or requested_leaf_count < 1
    or requested_visit_count < 0
    or requested_request_count < requested_leaf_count
  then
    raise exception 'Invalid resumable Jobber coverage pass input';
  end if;
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );
  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  if exists (
    select 1 from public.jobber_schedule_sync_work_items work
    where work.run_id = requested_run_id
      and work.pass_number = requested_pass
      and work.work_state in ('pending', 'in_progress')
  ) then
    raise exception 'Jobber coverage pass frontier is incomplete';
  end if;

  select pg_catalog.count(*)::integer,
    coalesce(pg_catalog.sum(partition.observation_count), 0)::integer
  into stored_leaf_count, stored_visit_count
  from public.jobber_schedule_sync_partitions partition
  where partition.run_id = requested_run_id
    and partition.pass_number = requested_pass;
  select pg_catalog.count(*)::integer into stored_request_count
  from public.jobber_schedule_sync_request_attempts attempt
  where attempt.run_id = requested_run_id
    and attempt.pass_number = requested_pass;
  if stored_leaf_count <> requested_leaf_count
    or stored_visit_count <> requested_visit_count
    or stored_request_count <> requested_request_count
    or stored_leaf_count <> (
      select pg_catalog.count(*)::integer
      from public.jobber_schedule_sync_work_items work
      where work.run_id = requested_run_id
        and work.pass_number = requested_pass
        and work.work_state = 'complete'
    )
  then
    raise exception 'Jobber coverage pass counts did not match durable frontier evidence';
  end if;

  if requested_pass = 1 then
    if run_row.pass_one_manifest_sha256 is not null then
      if run_row.pass_one_manifest_sha256 <> requested_manifest_sha256
        or run_row.pass_one_leaf_coverage_sha256 <> requested_leaf_coverage_sha256
        or run_row.pass_one_leaf_count <> requested_leaf_count
        or run_row.pass_one_visit_count <> requested_visit_count
      then
        raise exception 'Jobber coverage pass replay did not match';
      end if;
      return 'replay';
    end if;
    update public.jobber_schedule_sync_runs
    set pass_one_manifest_sha256 = requested_manifest_sha256,
        pass_one_leaf_coverage_sha256 = requested_leaf_coverage_sha256,
        pass_one_leaf_count = requested_leaf_count,
        pass_one_visit_count = requested_visit_count
    where id = requested_run_id;
    insert into public.jobber_schedule_sync_work_items (
      run_id, pass_number, partition_path, window_start, window_end, work_state
    ) values (
      requested_run_id, 2, 'r', run_row.window_start, run_row.window_end, 'pending'
    )
    on conflict (run_id, pass_number, partition_path) do nothing;
    return 'pass_two_ready';
  end if;

  if run_row.pass_one_manifest_sha256 is null then
    raise exception 'Jobber coverage pass two cannot precede pass one';
  end if;
  if run_row.pass_two_manifest_sha256 is not null then
    if run_row.pass_two_manifest_sha256 <> requested_manifest_sha256
      or run_row.pass_two_leaf_coverage_sha256 <> requested_leaf_coverage_sha256
      or run_row.pass_two_leaf_count <> requested_leaf_count
      or run_row.pass_two_visit_count <> requested_visit_count
    then
      raise exception 'Jobber coverage pass replay did not match';
    end if;
    return 'replay';
  end if;
  update public.jobber_schedule_sync_runs
  set pass_two_manifest_sha256 = requested_manifest_sha256,
      pass_two_leaf_coverage_sha256 = requested_leaf_coverage_sha256,
      pass_two_leaf_count = requested_leaf_count,
      pass_two_visit_count = requested_visit_count,
      visit_count = requested_visit_count
  where id = requested_run_id;
  return 'ready_to_finalize';
end;
$$;

create or replace function public.pause_jobber_schedule_coverage_sync(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  run_connection_id text;
  run_row public.jobber_schedule_sync_runs%rowtype;
  lock_row public.jobber_schedule_sync_locks%rowtype;
begin
  if requested_run_id is null
    or requested_actor_id is null
    or requested_acquisition_generation is null
    or requested_acquisition_generation < 1
    or requested_owner_token is null
  then
    raise exception 'Invalid Jobber schedule sync pause ownership fence';
  end if;
  perform 1
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'Jobber schedule sync actor is not active';
  end if;
  select run.connection_id into run_connection_id
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id;
  if not found then
    raise exception 'Jobber schedule sync run was not found';
  end if;

  select * into lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = run_connection_id
  for update;
  if not found
    or lock_row.acquisition_generation <> requested_acquisition_generation
    or lock_row.owner_token <> requested_owner_token
  then
    raise exception 'Jobber schedule sync ownership fence was lost';
  end if;

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
    and run.connection_id = run_connection_id
  for update;
  if not found then
    raise exception 'Jobber schedule sync run was not found';
  end if;
  if run_row.status = 'awaiting_continuation'
    and run_row.continuation_paused_at is not null
    and lock_row.active_run_id is null
  then
    return;
  end if;
  if run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  if lock_row.active_run_id <> run_row.id
    or lock_row.lease_expires_at <= changed_at
  then
    raise exception 'Jobber schedule sync ownership fence was lost';
  end if;
  if exists (
    select 1 from public.jobber_schedule_sync_work_items work
    where work.run_id = requested_run_id
      and work.work_state = 'in_progress'
  ) then
    raise exception 'Jobber schedule sync cannot pause with an in-progress request';
  end if;
  update public.jobber_schedule_sync_runs
  set status = 'awaiting_continuation', continuation_paused_at = changed_at
  where id = requested_run_id;
  update public.jobber_schedule_sync_locks
  set active_run_id = null, acquired_at = null, lease_expires_at = null
  where connection_id = run_row.connection_id
    and active_run_id = requested_run_id
    and acquisition_generation = requested_acquisition_generation
    and owner_token = requested_owner_token;
  if not found then
    raise exception 'Jobber schedule sync ownership fence was lost';
  end if;
end;
$$;

create or replace function public.mark_resumable_jobber_schedule_coverage_sync_partial(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_failure_code text,
  requested_request_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );
  perform public.mark_jobber_schedule_coverage_sync_partial(
    requested_run_id, requested_failure_code, requested_request_count
  );
end;
$$;

create or replace function public.finalize_resumable_jobber_schedule_coverage_sync(
  requested_run_id uuid,
  requested_actor_id uuid,
  requested_acquisition_generation bigint,
  requested_owner_token uuid,
  requested_expected_watermark_generation bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform public.assert_resumable_jobber_schedule_sync_owner(
    requested_run_id, requested_actor_id,
    requested_acquisition_generation, requested_owner_token
  );
  return public.finalize_jobber_schedule_coverage_sync(
    requested_run_id,
    requested_expected_watermark_generation
  );
end;
$$;

alter table public.jobber_schedule_sync_work_items enable row level security;
alter table public.jobber_schedule_sync_request_attempts enable row level security;

revoke all on table public.jobber_schedule_sync_work_items,
  public.jobber_schedule_sync_request_attempts
from public, anon, authenticated, service_role;
grant select on table public.jobber_schedule_sync_work_items,
  public.jobber_schedule_sync_request_attempts
to service_role;

revoke all on function public.reject_jobber_schedule_sync_attempt_change()
from public, anon, authenticated, service_role;
revoke all on function public.reject_jobber_schedule_sync_work_item_delete()
from public, anon, authenticated, service_role;
revoke all on function public.invalidate_jobber_visit_classification_on_manifest_omission()
from public, anon, authenticated, service_role;
revoke all on function public.assert_resumable_jobber_schedule_sync_owner(
  uuid, uuid, bigint, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.start_or_resume_jobber_schedule_coverage_sync(
  uuid, text, uuid, timestamptz, timestamptz, text
) from public, anon, authenticated, service_role;
revoke all on function public.renew_resumable_jobber_schedule_coverage_sync_lease(
  uuid, uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reserve_jobber_schedule_coverage_attempt(
  uuid, uuid, bigint, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.record_jobber_schedule_coverage_overflow(
  uuid, uuid, bigint, uuid, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.record_jobber_schedule_coverage_leaf(
  uuid, uuid, bigint, uuid, uuid, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.complete_resumable_jobber_schedule_coverage_pass(
  uuid, uuid, bigint, uuid, smallint, text, text,
  integer, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function public.pause_jobber_schedule_coverage_sync(
  uuid, uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.mark_resumable_jobber_schedule_coverage_sync_partial(
  uuid, uuid, bigint, uuid, text, integer
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_resumable_jobber_schedule_coverage_sync(
  uuid, uuid, bigint, uuid, bigint
) from public, anon, authenticated, service_role;

-- Migration 038 mutators remain owner-callable internals for the fenced
-- wrappers above, but are no longer directly executable by the service role.
revoke execute on function public.begin_jobber_schedule_coverage_sync(
  uuid, text, uuid, timestamptz, timestamptz, text
) from service_role;
revoke execute on function public.renew_jobber_schedule_coverage_sync_lease(uuid)
from service_role;
revoke execute on function public.append_jobber_schedule_coverage_leaf(
  uuid, smallint, integer, timestamptz, timestamptz, text, jsonb
) from service_role;
revoke execute on function public.complete_jobber_schedule_coverage_pass(
  uuid, smallint, text, text, integer, integer, integer
) from service_role;
revoke execute on function public.finalize_jobber_schedule_coverage_sync(uuid, bigint)
from service_role;
revoke execute on function public.mark_jobber_schedule_coverage_sync_partial(
  uuid, text, integer
) from service_role;

grant execute on function public.start_or_resume_jobber_schedule_coverage_sync(
  uuid, text, uuid, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.renew_resumable_jobber_schedule_coverage_sync_lease(
  uuid, uuid, bigint, uuid
) to service_role;
grant execute on function public.reserve_jobber_schedule_coverage_attempt(
  uuid, uuid, bigint, uuid, uuid
) to service_role;
grant execute on function public.record_jobber_schedule_coverage_overflow(
  uuid, uuid, bigint, uuid, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz
) to service_role;
grant execute on function public.record_jobber_schedule_coverage_leaf(
  uuid, uuid, bigint, uuid, uuid, text, jsonb
) to service_role;
grant execute on function public.complete_resumable_jobber_schedule_coverage_pass(
  uuid, uuid, bigint, uuid, smallint, text, text,
  integer, integer, integer
) to service_role;
grant execute on function public.pause_jobber_schedule_coverage_sync(
  uuid, uuid, bigint, uuid
) to service_role;
grant execute on function public.mark_resumable_jobber_schedule_coverage_sync_partial(
  uuid, uuid, bigint, uuid, text, integer
) to service_role;
grant execute on function public.finalize_resumable_jobber_schedule_coverage_sync(
  uuid, uuid, bigint, uuid, bigint
) to service_role;

comment on table public.jobber_schedule_sync_work_items is
  'Durable deterministic half-open temporal frontier for resumable two-pass Jobber coverage proof.';
comment on table public.jobber_schedule_sync_request_attempts is
  'Immutable reservation evidence for every Jobber coverage provider attempt, including interrupted attempts.';
comment on column public.jobber_schedule_sync_runs.continuation_paused_at is
  'Recoverable checkpoint time. Awaiting-continuation runs have not advanced the coverage watermark.';

commit;
