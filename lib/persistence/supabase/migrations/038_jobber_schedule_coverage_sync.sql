-- Coverage-proven, read-only Jobber schedule synchronization.
-- This schema cannot write HomeAtlas appointments, obligations, pricing,
-- billing, agreements, memberships, Stripe state, or Property Memory.

create table if not exists public.jobber_schedule_sync_runs (
  id uuid primary key,
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  actor_id uuid not null references public.hq_admin_users(user_id) on delete restrict,
  status text not null default 'running' check (status in ('running', 'complete', 'partial')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  graphql_version text not null,
  expected_watermark_generation bigint not null check (expected_watermark_generation >= 0),
  pass_one_manifest_sha256 text,
  pass_one_leaf_coverage_sha256 text,
  pass_one_leaf_count integer,
  pass_one_visit_count integer,
  pass_two_manifest_sha256 text,
  pass_two_leaf_coverage_sha256 text,
  pass_two_leaf_count integer,
  pass_two_visit_count integer,
  request_count integer not null default 0 check (request_count >= 0),
  leaf_count integer not null default 0 check (leaf_count >= 0),
  visit_count integer not null default 0 check (visit_count >= 0),
  failure_code text check (failure_code in (
    'duplicate_visit', 'graphql_partial_errors', 'http_429', 'http_error',
    'malformed_response', 'malformed_timestamp', 'manifest_mismatch',
    'query_cap_reached', 'storage_failure', 'timeout',
    'unsplittable_saturation', 'version_mismatch', 'version_warning',
    'watermark_conflict', 'window_violation'
  )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (window_start < window_end),
  check (
    (status = 'running' and completed_at is null and failure_code is null)
    or (status = 'complete' and completed_at is not null and failure_code is null)
    or (status = 'partial' and completed_at is not null and failure_code is not null)
  )
);

create index if not exists jobber_schedule_sync_runs_connection_started_idx
  on public.jobber_schedule_sync_runs(connection_id, started_at desc);

create table if not exists public.jobber_schedule_sync_partitions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jobber_schedule_sync_runs(id) on delete restrict,
  pass_number smallint not null check (pass_number in (1, 2)),
  leaf_index integer not null check (leaf_index >= 0),
  window_start timestamptz not null,
  window_end timestamptz not null,
  has_next_page boolean not null default false check (has_next_page = false),
  observation_count integer not null check (observation_count between 0 and 50),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default now(),
  unique (run_id, pass_number, leaf_index),
  unique (run_id, pass_number, window_start, window_end),
  check (window_start < window_end)
);

create index if not exists jobber_schedule_sync_partitions_run_idx
  on public.jobber_schedule_sync_partitions(run_id, pass_number, leaf_index);

create table if not exists public.jobber_visit_source_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jobber_schedule_sync_runs(id) on delete restrict,
  partition_id uuid not null references public.jobber_schedule_sync_partitions(id) on delete restrict,
  pass_number smallint not null check (pass_number in (1, 2)),
  external_visit_id text not null check (nullif(btrim(external_visit_id), '') is not null),
  source_payload_hash text not null check (source_payload_hash ~ '^[0-9a-f]{64}$'),
  source_observed_at timestamptz not null,
  source_payload jsonb not null,
  recorded_at timestamptz not null default now(),
  unique (run_id, pass_number, external_visit_id)
);

create index if not exists jobber_visit_source_observations_run_idx
  on public.jobber_visit_source_observations(run_id, pass_number, external_visit_id);

create table if not exists public.jobber_schedule_sync_watermarks (
  connection_id text primary key references public.jobber_connections(id) on delete restrict,
  run_id uuid not null references public.jobber_schedule_sync_runs(id) on delete restrict,
  window_start timestamptz not null,
  window_end timestamptz not null,
  covered_at timestamptz not null,
  generation bigint not null check (generation > 0),
  check (window_start < window_end)
);

create table if not exists public.jobber_schedule_sync_locks (
  connection_id text primary key references public.jobber_connections(id) on delete restrict,
  active_run_id uuid references public.jobber_schedule_sync_runs(id) on delete restrict,
  acquired_at timestamptz,
  lease_expires_at timestamptz,
  check (
    (active_run_id is null and acquired_at is null and lease_expires_at is null)
    or (active_run_id is not null and acquired_at is not null and lease_expires_at is not null)
  )
);

create or replace function public.reject_jobber_schedule_sync_evidence_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber schedule sync evidence is append-only and immutable';
end;
$$;

drop trigger if exists jobber_schedule_sync_partitions_immutable
  on public.jobber_schedule_sync_partitions;
create trigger jobber_schedule_sync_partitions_immutable
  before update or delete on public.jobber_schedule_sync_partitions
  for each row execute function public.reject_jobber_schedule_sync_evidence_change();

drop trigger if exists jobber_visit_source_observations_immutable
  on public.jobber_visit_source_observations;
create trigger jobber_visit_source_observations_immutable
  before update or delete on public.jobber_visit_source_observations
  for each row execute function public.reject_jobber_schedule_sync_evidence_change();

create or replace function public.reject_jobber_schedule_sync_run_delete()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Jobber schedule sync runs cannot be deleted';
end;
$$;

drop trigger if exists jobber_schedule_sync_runs_no_delete
  on public.jobber_schedule_sync_runs;
create trigger jobber_schedule_sync_runs_no_delete
  before delete on public.jobber_schedule_sync_runs
  for each row execute function public.reject_jobber_schedule_sync_run_delete();

create or replace function public.begin_jobber_schedule_coverage_sync(
  requested_run_id uuid,
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
  lock_row public.jobber_schedule_sync_locks%rowtype;
  watermark_generation bigint := 0;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_run_id is null
    or requested_connection_id is null
    or pg_catalog.btrim(requested_connection_id) = ''
    or requested_actor_id is null
    or requested_window_start is null
    or requested_window_end is null
    or requested_window_start >= requested_window_end
    or requested_graphql_version is null
    or pg_catalog.btrim(requested_graphql_version) = ''
  then
    raise exception 'Invalid Jobber schedule sync reservation input';
  end if;

  if not exists (
    select 1
    from public.hq_admin_users actor
    where actor.user_id = requested_actor_id
      and actor.active = true
      and actor.role in ('owner', 'operator')
  ) then
    raise exception 'Jobber schedule sync actor is not active';
  end if;

  if not exists (
    select 1
    from public.jobber_connections connection
    where connection.id = requested_connection_id
      and connection.status = 'connected'
      and connection.graphql_version = requested_graphql_version
  ) then
    raise exception 'Jobber connection or pinned version is unavailable';
  end if;

  insert into public.jobber_schedule_sync_locks (connection_id)
  values (requested_connection_id)
  on conflict (connection_id) do nothing;

  select * into lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = requested_connection_id
  for update;

  if lock_row.active_run_id is not null
    and lock_row.lease_expires_at > changed_at
    and lock_row.active_run_id <> requested_run_id
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'locked',
      'watermark_generation', coalesce((
        select watermark.generation
        from public.jobber_schedule_sync_watermarks watermark
        where watermark.connection_id = requested_connection_id
      ), 0)
    );
  end if;

  if lock_row.active_run_id is not null
    and lock_row.active_run_id <> requested_run_id
  then
    update public.jobber_schedule_sync_runs
    set status = 'partial',
        failure_code = 'storage_failure',
        completed_at = changed_at
    where id = lock_row.active_run_id
      and status = 'running';
  end if;

  select watermark.generation into watermark_generation
  from public.jobber_schedule_sync_watermarks watermark
  where watermark.connection_id = requested_connection_id;
  watermark_generation := coalesce(watermark_generation, 0);

  insert into public.jobber_schedule_sync_runs (
    id, connection_id, actor_id, window_start, window_end,
    graphql_version, expected_watermark_generation
  ) values (
    requested_run_id, requested_connection_id, requested_actor_id,
    requested_window_start, requested_window_end, requested_graphql_version,
    watermark_generation
  )
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.jobber_schedule_sync_runs run
    where run.id = requested_run_id
      and run.connection_id = requested_connection_id
      and run.actor_id = requested_actor_id
      and run.window_start = requested_window_start
      and run.window_end = requested_window_end
      and run.graphql_version = requested_graphql_version
      and run.expected_watermark_generation = watermark_generation
      and run.status = 'running'
  ) then
    raise exception 'Jobber schedule sync run replay did not match';
  end if;

  update public.jobber_schedule_sync_locks
  set active_run_id = requested_run_id,
      acquired_at = changed_at,
      lease_expires_at = changed_at + pg_catalog.make_interval(mins => 10)
  where connection_id = requested_connection_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'acquired',
    'watermark_generation', watermark_generation
  );
end;
$$;

create or replace function public.renew_jobber_schedule_coverage_sync_lease(
  requested_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_run_id is null then
    raise exception 'Invalid Jobber schedule sync lease renewal input';
  end if;

  update public.jobber_schedule_sync_locks sync_lock
  set lease_expires_at = changed_at + pg_catalog.make_interval(mins => 10)
  where sync_lock.active_run_id = requested_run_id
    and sync_lock.lease_expires_at > changed_at
    and exists (
      select 1
      from public.jobber_schedule_sync_runs run
      where run.id = requested_run_id
        and run.connection_id = sync_lock.connection_id
        and run.status = 'running'
    );
  if not found then
    raise exception 'Jobber schedule sync lease was lost';
  end if;
end;
$$;

create or replace function public.append_jobber_schedule_coverage_leaf(
  requested_run_id uuid,
  requested_pass smallint,
  requested_leaf_index integer,
  requested_window_start timestamptz,
  requested_window_end timestamptz,
  requested_manifest_sha256 text,
  requested_observations jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  run_row public.jobber_schedule_sync_runs%rowtype;
  existing_partition public.jobber_schedule_sync_partitions%rowtype;
  next_partition_id uuid;
  observation_count integer;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_run_id is null
    or requested_pass is null
    or requested_pass not in (1, 2)
    or requested_leaf_index is null
    or requested_leaf_index < 0
    or requested_window_start is null
    or requested_window_end is null
    or requested_window_start >= requested_window_end
    or requested_manifest_sha256 is null
    or requested_manifest_sha256 !~ '^[0-9a-f]{64}$'
    or requested_observations is null
    or pg_catalog.jsonb_typeof(requested_observations) <> 'array'
  then
    raise exception 'Invalid Jobber schedule sync leaf input';
  end if;

  observation_count := pg_catalog.jsonb_array_length(requested_observations);
  if observation_count > 50 then
    raise exception 'Jobber schedule sync leaf exceeded first:50';
  end if;

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;

  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  if not exists (
    select 1
    from public.jobber_schedule_sync_locks sync_lock
    where sync_lock.connection_id = run_row.connection_id
      and sync_lock.active_run_id = requested_run_id
      and sync_lock.lease_expires_at > changed_at
    for update
  ) then
    raise exception 'Jobber schedule sync lease was lost';
  end if;

  select * into existing_partition
  from public.jobber_schedule_sync_partitions partition
  where partition.run_id = requested_run_id
    and partition.pass_number = requested_pass
    and partition.leaf_index = requested_leaf_index;
  if found then
    if existing_partition.window_start <> requested_window_start
      or existing_partition.window_end <> requested_window_end
      or existing_partition.observation_count <> observation_count
      or existing_partition.manifest_sha256 <> requested_manifest_sha256
    then
      raise exception 'Jobber schedule sync leaf replay did not match';
    end if;
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(requested_observations) item
      left join public.jobber_visit_source_observations observation
        on observation.run_id = requested_run_id
       and observation.pass_number = requested_pass
       and observation.external_visit_id = item->>'external_visit_id'
      where observation.id is null
        or observation.source_payload_hash <> item->>'source_payload_hash'
        or observation.source_observed_at <> (item->>'source_observed_at')::timestamptz
        or observation.source_payload is distinct from item
    ) then
      raise exception 'Jobber schedule sync leaf replay observations did not match';
    end if;
    return;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(requested_observations) item
    where pg_catalog.jsonb_typeof(item) <> 'object'
      or coalesce(item->>'external_visit_id', '') = ''
      or coalesce(item->>'source_payload_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(item->>'source_observed_at', '') = ''
      or pg_catalog.jsonb_typeof(item->'raw_payload') <> 'object'
      or coalesce(item->>'scheduled_start', '') = ''
      or item->'raw_payload'->>'id' is distinct from item->>'external_visit_id'
      or (item->>'scheduled_start')::timestamptz < requested_window_start
      or (item->>'scheduled_start')::timestamptz >= requested_window_end
  ) then
    raise exception 'Jobber schedule sync observation was malformed';
  end if;

  next_partition_id := pg_catalog.gen_random_uuid();
  insert into public.jobber_schedule_sync_partitions (
    id, run_id, pass_number, leaf_index, window_start, window_end,
    has_next_page, observation_count, manifest_sha256
  ) values (
    next_partition_id, requested_run_id, requested_pass, requested_leaf_index,
    requested_window_start, requested_window_end, false, observation_count,
    requested_manifest_sha256
  );

  insert into public.jobber_visit_source_observations (
    run_id, partition_id, pass_number, external_visit_id,
    source_payload_hash, source_observed_at, source_payload
  )
  select
    requested_run_id,
    next_partition_id,
    requested_pass,
    item->>'external_visit_id',
    item->>'source_payload_hash',
    (item->>'source_observed_at')::timestamptz,
    item
  from pg_catalog.jsonb_array_elements(requested_observations) item;

  update public.jobber_schedule_sync_runs
  set leaf_count = leaf_count + 1
  where id = requested_run_id;
  update public.jobber_schedule_sync_locks
  set lease_expires_at = changed_at + pg_catalog.make_interval(mins => 10)
  where connection_id = run_row.connection_id
    and active_run_id = requested_run_id;
end;
$$;

create or replace function public.complete_jobber_schedule_coverage_pass(
  requested_run_id uuid,
  requested_pass smallint,
  requested_manifest_sha256 text,
  requested_leaf_coverage_sha256 text,
  requested_leaf_count integer,
  requested_visit_count integer,
  requested_request_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  run_row public.jobber_schedule_sync_runs%rowtype;
  stored_leaf_count integer;
  stored_visit_count integer;
begin
  if requested_run_id is null
    or requested_pass is null
    or requested_pass not in (1, 2)
    or requested_manifest_sha256 is null
    or requested_manifest_sha256 !~ '^[0-9a-f]{64}$'
    or requested_leaf_coverage_sha256 is null
    or requested_leaf_coverage_sha256 !~ '^[0-9a-f]{64}$'
    or requested_leaf_count is null or requested_leaf_count < 1
    or requested_visit_count is null or requested_visit_count < 0
    or requested_request_count is null
    or requested_request_count < requested_leaf_count
  then
    raise exception 'Invalid Jobber schedule sync pass input';
  end if;

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found or run_row.status <> 'running' then
    raise exception 'Jobber schedule sync run is not active';
  end if;
  if not exists (
    select 1 from public.jobber_schedule_sync_locks sync_lock
    where sync_lock.connection_id = run_row.connection_id
      and sync_lock.active_run_id = requested_run_id
      and sync_lock.lease_expires_at > pg_catalog.now()
    for update
  ) then
    raise exception 'Jobber schedule sync lease was lost';
  end if;

  select pg_catalog.count(*)::integer,
         coalesce(pg_catalog.sum(partition.observation_count), 0)::integer
  into stored_leaf_count, stored_visit_count
  from public.jobber_schedule_sync_partitions partition
  where partition.run_id = requested_run_id
    and partition.pass_number = requested_pass;
  if stored_leaf_count <> requested_leaf_count
    or stored_visit_count <> requested_visit_count
  then
    raise exception 'Jobber schedule sync pass counts did not match durable evidence';
  end if;

  if requested_pass = 1 then
    if run_row.pass_one_manifest_sha256 is not null then
      if run_row.pass_one_manifest_sha256 <> requested_manifest_sha256
        or run_row.pass_one_leaf_coverage_sha256 <> requested_leaf_coverage_sha256
        or run_row.pass_one_leaf_count <> requested_leaf_count
        or run_row.pass_one_visit_count <> requested_visit_count
      then
        raise exception 'Jobber schedule sync pass replay did not match';
      end if;
      return;
    end if;
    update public.jobber_schedule_sync_runs
    set pass_one_manifest_sha256 = requested_manifest_sha256,
        pass_one_leaf_coverage_sha256 = requested_leaf_coverage_sha256,
        pass_one_leaf_count = requested_leaf_count,
        pass_one_visit_count = requested_visit_count,
        request_count = request_count + requested_request_count
    where id = requested_run_id;
  else
    if run_row.pass_one_manifest_sha256 is null then
      raise exception 'Jobber schedule sync pass two cannot precede pass one';
    end if;
    if run_row.pass_two_manifest_sha256 is not null then
      if run_row.pass_two_manifest_sha256 <> requested_manifest_sha256
        or run_row.pass_two_leaf_coverage_sha256 <> requested_leaf_coverage_sha256
        or run_row.pass_two_leaf_count <> requested_leaf_count
        or run_row.pass_two_visit_count <> requested_visit_count
      then
        raise exception 'Jobber schedule sync pass replay did not match';
      end if;
      return;
    end if;
    update public.jobber_schedule_sync_runs
    set pass_two_manifest_sha256 = requested_manifest_sha256,
        pass_two_leaf_coverage_sha256 = requested_leaf_coverage_sha256,
        pass_two_leaf_count = requested_leaf_count,
        pass_two_visit_count = requested_visit_count,
        visit_count = requested_visit_count,
        request_count = request_count + requested_request_count
    where id = requested_run_id;
  end if;
end;
$$;

create or replace function public.finalize_jobber_schedule_coverage_sync(
  requested_run_id uuid,
  requested_expected_watermark_generation bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  run_row public.jobber_schedule_sync_runs%rowtype;
  current_generation bigint;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_run_id is null
    or requested_expected_watermark_generation is null
    or requested_expected_watermark_generation < 0
  then
    raise exception 'Invalid Jobber schedule sync finalization input';
  end if;

  select * into run_row
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found then
    raise exception 'Jobber schedule sync run was not found';
  end if;
  if run_row.status = 'complete' then
    if exists (
      select 1
      from public.jobber_schedule_sync_watermarks watermark
      where watermark.connection_id = run_row.connection_id
        and watermark.run_id = run_row.id
        and watermark.window_start = run_row.window_start
        and watermark.window_end = run_row.window_end
        and watermark.covered_at = run_row.completed_at
        and watermark.generation = run_row.expected_watermark_generation + 1
    ) then
      return 'replay';
    end if;
    return 'watermark_conflict';
  end if;
  if run_row.status <> 'running' then
    return 'unstable';
  end if;
  if run_row.expected_watermark_generation <> requested_expected_watermark_generation
    or run_row.pass_one_manifest_sha256 is null
    or run_row.pass_two_manifest_sha256 is null
    or run_row.pass_one_manifest_sha256 <> run_row.pass_two_manifest_sha256
    or run_row.pass_one_leaf_coverage_sha256 <> run_row.pass_two_leaf_coverage_sha256
    or run_row.pass_one_leaf_count <> run_row.pass_two_leaf_count
    or run_row.pass_one_visit_count <> run_row.pass_two_visit_count
  then
    return 'unstable';
  end if;
  if not exists (
    select 1 from public.jobber_schedule_sync_locks sync_lock
    where sync_lock.connection_id = run_row.connection_id
      and sync_lock.active_run_id = requested_run_id
      and sync_lock.lease_expires_at > changed_at
    for update
  ) then
    return 'unstable';
  end if;

  if exists (
    select 1
    from (
      select * from public.jobber_visit_source_observations
      where run_id = requested_run_id and pass_number = 1
    ) first_pass
    full join (
      select * from public.jobber_visit_source_observations
      where run_id = requested_run_id and pass_number = 2
    ) second_pass
      on second_pass.run_id = first_pass.run_id
     and second_pass.external_visit_id = first_pass.external_visit_id
    where (
        first_pass.id is null
        or second_pass.id is null
        or first_pass.source_payload_hash <> second_pass.source_payload_hash
      )
  ) or exists (
    select 1
    from (
      select * from public.jobber_schedule_sync_partitions
      where run_id = requested_run_id and pass_number = 1
    ) first_leaf
    full join (
      select * from public.jobber_schedule_sync_partitions
      where run_id = requested_run_id and pass_number = 2
    ) second_leaf
      on second_leaf.run_id = first_leaf.run_id
     and second_leaf.leaf_index = first_leaf.leaf_index
    where (
        first_leaf.id is null
        or second_leaf.id is null
        or first_leaf.window_start <> second_leaf.window_start
        or first_leaf.window_end <> second_leaf.window_end
        or first_leaf.observation_count <> second_leaf.observation_count
        or first_leaf.manifest_sha256 <> second_leaf.manifest_sha256
      )
  ) then
    return 'unstable';
  end if;

  if exists (
    select 1
    from (values (1::smallint), (2::smallint)) pass(pass_number)
    where not exists (
      select 1
      from public.jobber_schedule_sync_partitions partition
      where partition.run_id = requested_run_id
        and partition.pass_number = pass.pass_number
    )
      or (
        select pg_catalog.min(partition.window_start)
        from public.jobber_schedule_sync_partitions partition
        where partition.run_id = requested_run_id
          and partition.pass_number = pass.pass_number
      ) <> run_row.window_start
      or (
        select pg_catalog.max(partition.window_end)
        from public.jobber_schedule_sync_partitions partition
        where partition.run_id = requested_run_id
          and partition.pass_number = pass.pass_number
      ) <> run_row.window_end
      or exists (
        select 1
        from (
          select partition.window_start,
                 pg_catalog.lag(partition.window_end) over (
                   order by partition.window_start, partition.window_end
                 ) as previous_end
          from public.jobber_schedule_sync_partitions partition
          where partition.run_id = requested_run_id
            and partition.pass_number = pass.pass_number
        ) ordered_partition
        where ordered_partition.previous_end is not null
          and ordered_partition.previous_end <> ordered_partition.window_start
      )
  ) then
    return 'unstable';
  end if;

  select watermark.generation into current_generation
  from public.jobber_schedule_sync_watermarks watermark
  where watermark.connection_id = run_row.connection_id
  for update;
  current_generation := coalesce(current_generation, 0);
  if current_generation <> requested_expected_watermark_generation then
    return 'watermark_conflict';
  end if;

  insert into public.jobber_visit_projections (
    connection_id, provider, external_visit_id, external_job_id,
    external_client_id, external_property_id, jobber_property_web_uri,
    job_number, title, client_name, visit_status, job_status, is_complete,
    scheduled_start, scheduled_end, completed_at, raw_payload,
    source_payload_hash, source_observed_at, last_seen_at
  )
  select
    run_row.connection_id,
    'jobber',
    observation.source_payload->>'external_visit_id',
    observation.source_payload->>'external_job_id',
    observation.source_payload->>'external_client_id',
    observation.source_payload->>'external_property_id',
    observation.source_payload->>'jobber_property_web_uri',
    (observation.source_payload->>'job_number')::integer,
    observation.source_payload->>'title',
    observation.source_payload->>'client_name',
    observation.source_payload->>'visit_status',
    observation.source_payload->>'job_status',
    (observation.source_payload->>'is_complete')::boolean,
    (observation.source_payload->>'scheduled_start')::timestamptz,
    nullif(observation.source_payload->>'scheduled_end', '')::timestamptz,
    nullif(observation.source_payload->>'completed_at', '')::timestamptz,
    observation.source_payload->'raw_payload',
    observation.source_payload_hash,
    observation.source_observed_at,
    observation.source_observed_at
  from public.jobber_visit_source_observations observation
  where observation.run_id = requested_run_id
    and observation.pass_number = 2
  on conflict (connection_id, external_visit_id) do update
  set external_job_id = excluded.external_job_id,
      external_client_id = excluded.external_client_id,
      external_property_id = excluded.external_property_id,
      jobber_property_web_uri = excluded.jobber_property_web_uri,
      job_number = excluded.job_number,
      title = excluded.title,
      client_name = excluded.client_name,
      visit_status = excluded.visit_status,
      job_status = excluded.job_status,
      is_complete = excluded.is_complete,
      scheduled_start = excluded.scheduled_start,
      scheduled_end = excluded.scheduled_end,
      completed_at = excluded.completed_at,
      raw_payload = excluded.raw_payload,
      source_payload_hash = excluded.source_payload_hash,
      source_observed_at = excluded.source_observed_at,
      last_seen_at = excluded.last_seen_at
  where public.jobber_visit_projections.source_observed_at <= excluded.source_observed_at;

  insert into public.jobber_schedule_sync_watermarks (
    connection_id, run_id, window_start, window_end, covered_at, generation
  ) values (
    run_row.connection_id, requested_run_id, run_row.window_start,
    run_row.window_end, changed_at, requested_expected_watermark_generation + 1
  )
  on conflict (connection_id) do update
  set run_id = excluded.run_id,
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      covered_at = excluded.covered_at,
      generation = excluded.generation
  where public.jobber_schedule_sync_watermarks.generation = requested_expected_watermark_generation;
  if not found then
    raise exception 'Jobber schedule sync watermark compare-and-set failed';
  end if;

  update public.jobber_schedule_sync_runs
  set status = 'complete',
      completed_at = changed_at
  where id = requested_run_id;
  update public.jobber_schedule_sync_locks
  set active_run_id = null,
      acquired_at = null,
      lease_expires_at = null
  where connection_id = run_row.connection_id
    and active_run_id = requested_run_id;
  return 'completed';
end;
$$;

create or replace function public.reconcile_jobber_schedule_coverage_finalization(
  requested_run_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if requested_run_id is null then
    raise exception 'Invalid Jobber schedule sync finalization reconciliation input';
  end if;

  if exists (
    select 1
    from public.jobber_schedule_sync_runs run
    join public.jobber_schedule_sync_watermarks watermark
      on watermark.connection_id = run.connection_id
     and watermark.run_id = run.id
    where run.id = requested_run_id
      and run.status = 'complete'
      and run.completed_at is not null
      and watermark.window_start = run.window_start
      and watermark.window_end = run.window_end
      and watermark.covered_at = run.completed_at
      and watermark.generation = run.expected_watermark_generation + 1
  ) then
    return 'completed';
  end if;
  return 'not_completed';
end;
$$;

create or replace function public.mark_jobber_schedule_coverage_sync_partial(
  requested_run_id uuid,
  requested_failure_code text,
  requested_request_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  run_connection_id text;
begin
  if requested_run_id is null
    or requested_request_count is null
    or requested_request_count < 0
    or requested_failure_code is null
    or requested_failure_code not in (
    'duplicate_visit', 'graphql_partial_errors', 'http_429', 'http_error',
    'malformed_response', 'malformed_timestamp', 'manifest_mismatch',
    'query_cap_reached', 'storage_failure', 'timeout',
    'unsplittable_saturation', 'version_mismatch', 'version_warning',
    'watermark_conflict', 'window_violation'
  ) then
    raise exception 'Invalid Jobber schedule sync partial input';
  end if;

  select run.connection_id into run_connection_id
  from public.jobber_schedule_sync_runs run
  where run.id = requested_run_id
  for update;
  if not found then
    raise exception 'Jobber schedule sync run was not found';
  end if;

  update public.jobber_schedule_sync_runs
  set status = 'partial',
      failure_code = requested_failure_code,
      request_count = greatest(request_count, requested_request_count),
      completed_at = pg_catalog.now()
  where id = requested_run_id
    and status = 'running';
  update public.jobber_schedule_sync_locks
  set active_run_id = null,
      acquired_at = null,
      lease_expires_at = null
  where connection_id = run_connection_id
    and active_run_id = requested_run_id;
end;
$$;

alter table public.jobber_schedule_sync_runs enable row level security;
alter table public.jobber_schedule_sync_partitions enable row level security;
alter table public.jobber_visit_source_observations enable row level security;
alter table public.jobber_schedule_sync_watermarks enable row level security;
alter table public.jobber_schedule_sync_locks enable row level security;

revoke all on table public.jobber_schedule_sync_runs,
  public.jobber_schedule_sync_partitions,
  public.jobber_visit_source_observations,
  public.jobber_schedule_sync_watermarks,
  public.jobber_schedule_sync_locks
from public, anon, authenticated, service_role;
grant select on table public.jobber_schedule_sync_runs,
  public.jobber_schedule_sync_partitions,
  public.jobber_visit_source_observations,
  public.jobber_schedule_sync_watermarks,
  public.jobber_schedule_sync_locks
to service_role;

revoke all on function public.begin_jobber_schedule_coverage_sync(
  uuid, text, uuid, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.reject_jobber_schedule_sync_evidence_change()
from public, anon, authenticated, service_role;
revoke all on function public.reject_jobber_schedule_sync_run_delete()
from public, anon, authenticated, service_role;
revoke all on function public.append_jobber_schedule_coverage_leaf(
  uuid, smallint, integer, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;
revoke all on function public.renew_jobber_schedule_coverage_sync_lease(
  uuid
) from public, anon, authenticated;
revoke all on function public.complete_jobber_schedule_coverage_pass(
  uuid, smallint, text, text, integer, integer, integer
) from public, anon, authenticated;
revoke all on function public.finalize_jobber_schedule_coverage_sync(
  uuid, bigint
) from public, anon, authenticated;
revoke all on function public.reconcile_jobber_schedule_coverage_finalization(
  uuid
) from public, anon, authenticated;
revoke all on function public.mark_jobber_schedule_coverage_sync_partial(
  uuid, text, integer
) from public, anon, authenticated;

grant execute on function public.begin_jobber_schedule_coverage_sync(
  uuid, text, uuid, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.append_jobber_schedule_coverage_leaf(
  uuid, smallint, integer, timestamptz, timestamptz, text, jsonb
) to service_role;
grant execute on function public.renew_jobber_schedule_coverage_sync_lease(
  uuid
) to service_role;
grant execute on function public.complete_jobber_schedule_coverage_pass(
  uuid, smallint, text, text, integer, integer, integer
) to service_role;
grant execute on function public.finalize_jobber_schedule_coverage_sync(
  uuid, bigint
) to service_role;
grant execute on function public.reconcile_jobber_schedule_coverage_finalization(
  uuid
) to service_role;
grant execute on function public.mark_jobber_schedule_coverage_sync_partial(
  uuid, text, integer
) to service_role;

comment on table public.jobber_schedule_sync_runs is
  'Durable two-pass Jobber schedule coverage runs. Partial runs never advance coverage.';
comment on table public.jobber_visit_source_observations is
  'Immutable read-only Jobber source observations. Absence never represents deletion or cancellation.';
comment on table public.jobber_schedule_sync_watermarks is
  'CAS-protected proof that one fixed Jobber window was stable across two complete passes.';
