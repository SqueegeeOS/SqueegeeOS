-- HomeAtlas-native technician staffing for businesses without extra Jobber seats.
-- Jobber remains the appointment and schedule authority; these rows only assign
-- an active HomeAtlas technician to an exact mirrored Jobber visit.

begin;

create table if not exists public.homeatlas_technician_visit_assignments (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  projection_id uuid not null unique references public.jobber_visit_projections(id) on delete restrict,
  external_visit_id text not null,
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  technician_display_name text not null,
  assigned_by text not null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_visit_id),
  check (nullif(trim(external_visit_id), '') is not null),
  check (nullif(trim(technician_display_name), '') is not null and char_length(technician_display_name) <= 80),
  check (nullif(trim(assigned_by), '') is not null and char_length(assigned_by) <= 100)
);

create table if not exists public.homeatlas_technician_visit_assignment_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  assignment_id uuid not null references public.homeatlas_technician_visit_assignments(id) on delete restrict,
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  projection_id uuid not null references public.jobber_visit_projections(id) on delete restrict,
  external_visit_id text not null,
  previous_technician_id uuid references public.homeatlas_technicians(id) on delete restrict,
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  technician_display_name text not null,
  actor text not null,
  source_observed_at timestamptz,
  occurred_at timestamptz not null default now()
);

create table if not exists public.homeatlas_technician_job_clocks (
  id uuid primary key,
  assignment_id uuid not null unique references public.homeatlas_technician_visit_assignments(id) on delete restrict,
  external_visit_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by_access_grant_id uuid not null references public.technician_access_grants(id) on delete restrict,
  started_by_display_name text not null,
  finish_action_id uuid unique,
  finished_by_access_grant_id uuid references public.technician_access_grants(id) on delete restrict,
  finished_by_display_name text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (
    (ended_at is null and finish_action_id is null and finished_by_access_grant_id is null and finished_by_display_name is null)
    or
    (ended_at is not null and finish_action_id is not null and finished_by_access_grant_id is not null and nullif(trim(coalesce(finished_by_display_name, '')), '') is not null)
  )
);

create table if not exists public.homeatlas_technician_job_closeouts (
  id uuid primary key default gen_random_uuid(),
  field_record_id uuid not null unique,
  assignment_id uuid not null unique references public.homeatlas_technician_visit_assignments(id) on delete restrict,
  external_visit_id text not null,
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  technician_display_name text not null,
  visit_date date not null,
  customer_summary text not null default '',
  internal_note text not null default '',
  follow_up_needed boolean not null default false,
  scope_read_state text not null check (scope_read_state in ('available', 'partial', 'permission_hidden', 'not_observed')),
  service_scope jsonb not null default '[]'::jsonb check (jsonb_typeof(service_scope) = 'array'),
  scope_exception text not null default '',
  created_at timestamptz not null default now(),
  check (char_length(customer_summary) <= 1200),
  check (char_length(internal_note) <= 2500),
  check (char_length(scope_exception) <= 1200),
  check (nullif(trim(technician_display_name), '') is not null and char_length(technician_display_name) <= 80)
);

create table if not exists public.homeatlas_technician_job_photos (
  id uuid primary key default gen_random_uuid(),
  field_record_id uuid not null references public.homeatlas_technician_job_closeouts(field_record_id) on delete restrict,
  client_id uuid not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  capture_type text not null check (capture_type in ('before', 'after', 'detail')),
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (field_record_id, client_id)
);

create index if not exists homeatlas_technician_visit_assignments_tech_idx
  on public.homeatlas_technician_visit_assignments(technician_id, assigned_at desc);
create index if not exists homeatlas_technician_assignment_events_visit_idx
  on public.homeatlas_technician_visit_assignment_events(external_visit_id, occurred_at desc);
create index if not exists homeatlas_technician_job_closeouts_follow_up_idx
  on public.homeatlas_technician_job_closeouts(created_at desc)
  where follow_up_needed = true;

drop trigger if exists homeatlas_technician_visit_assignments_updated_at
  on public.homeatlas_technician_visit_assignments;
create trigger homeatlas_technician_visit_assignments_updated_at
  before update on public.homeatlas_technician_visit_assignments
  for each row execute function public.set_updated_at();

create or replace function public.reject_homeatlas_technician_assignment_event_change()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  raise exception 'homeatlas_technician_visit_assignment_events is append-only and immutable';
end;
$$;

drop trigger if exists homeatlas_technician_assignment_events_immutable
  on public.homeatlas_technician_visit_assignment_events;
create trigger homeatlas_technician_assignment_events_immutable
  before update or delete on public.homeatlas_technician_visit_assignment_events
  for each row execute function public.reject_homeatlas_technician_assignment_event_change();

alter table public.homeatlas_technician_visit_assignments enable row level security;
alter table public.homeatlas_technician_visit_assignment_events enable row level security;
alter table public.homeatlas_technician_job_clocks enable row level security;
alter table public.homeatlas_technician_job_closeouts enable row level security;
alter table public.homeatlas_technician_job_photos enable row level security;

revoke all on table public.homeatlas_technician_visit_assignments from public, anon, authenticated;
revoke all on table public.homeatlas_technician_visit_assignment_events from public, anon, authenticated;
revoke all on table public.homeatlas_technician_job_clocks from public, anon, authenticated;
revoke all on table public.homeatlas_technician_job_closeouts from public, anon, authenticated;
revoke all on table public.homeatlas_technician_job_photos from public, anon, authenticated;
grant select, insert, update on table public.homeatlas_technician_visit_assignments to service_role;
grant select, insert on table public.homeatlas_technician_visit_assignment_events to service_role;
grant select, insert, update on table public.homeatlas_technician_job_clocks to service_role;
grant select, insert on table public.homeatlas_technician_job_closeouts to service_role;
grant select, insert on table public.homeatlas_technician_job_photos to service_role;

create or replace function public.assign_homeatlas_technician_visit(
  p_client_request_id uuid,
  p_projection_id uuid,
  p_technician_id uuid,
  p_expected_technician_id uuid,
  p_actor text
)
returns table(
  assignment_id uuid,
  technician_id uuid,
  technician_display_name text,
  assigned_at timestamptz,
  replayed boolean
)
language plpgsql security definer set search_path = public as $$
declare
  projection_row public.jobber_visit_projections%rowtype;
  technician_row public.homeatlas_technicians%rowtype;
  assignment_row public.homeatlas_technician_visit_assignments%rowtype;
  prior_event public.homeatlas_technician_visit_assignment_events%rowtype;
  previous_id uuid;
begin
  if p_client_request_id is null or p_projection_id is null or p_technician_id is null
     or nullif(trim(coalesce(p_actor, '')), '') is null or char_length(trim(p_actor)) > 100 then
    raise exception 'Choose a valid future visit and HomeAtlas technician';
  end if;

  select * into prior_event
  from public.homeatlas_technician_visit_assignment_events
  where client_request_id = p_client_request_id;
  if found then
    select * into assignment_row from public.homeatlas_technician_visit_assignments where id = prior_event.assignment_id;
    return query select assignment_row.id, assignment_row.technician_id,
      assignment_row.technician_display_name, assignment_row.assigned_at, true;
    return;
  end if;

  select * into projection_row
  from public.jobber_visit_projections
  where id = p_projection_id and connection_id = 'squeegeeking'
  for update;
  if not found then raise exception 'That Jobber visit is no longer in HomeAtlas'; end if;
  if projection_row.is_complete or projection_row.visit_status = 'REMOVED'
     or projection_row.scheduled_start is null or projection_row.scheduled_start <= now() then
    raise exception 'Only an active future Jobber visit can be assigned here';
  end if;

  select * into technician_row
  from public.homeatlas_technicians
  where id = p_technician_id and status = 'active';
  if not found then raise exception 'Choose an active HomeAtlas technician'; end if;

  select * into assignment_row
  from public.homeatlas_technician_visit_assignments
  where projection_id = p_projection_id
  for update;
  previous_id := assignment_row.technician_id;
  if found and assignment_row.technician_id = p_technician_id then
    return query select assignment_row.id, assignment_row.technician_id,
      assignment_row.technician_display_name, assignment_row.assigned_at, true;
    return;
  end if;
  if found and (
    exists (
      select 1 from public.homeatlas_technician_job_clocks clock_row_check
      where clock_row_check.assignment_id = assignment_row.id
    )
    or exists (
      select 1 from public.homeatlas_technician_job_closeouts closeout_row_check
      where closeout_row_check.assignment_id = assignment_row.id
    )
  ) then
    raise exception 'This visit already has field activity and cannot be reassigned';
  end if;
  if previous_id is distinct from p_expected_technician_id then
    raise exception 'HomeAtlas changed this visit after Dispatch loaded. Refresh before replacing its technician';
  end if;

  insert into public.homeatlas_technician_visit_assignments (
    connection_id, projection_id, external_visit_id, technician_id,
    technician_display_name, assigned_by
  ) values (
    projection_row.connection_id, projection_row.id, projection_row.external_visit_id,
    technician_row.id, technician_row.display_name, trim(p_actor)
  )
  on conflict (projection_id) do update set
    technician_id = excluded.technician_id,
    technician_display_name = excluded.technician_display_name,
    assigned_by = excluded.assigned_by,
    assigned_at = now(),
    updated_at = now()
  returning * into assignment_row;

  insert into public.homeatlas_technician_visit_assignment_events (
    client_request_id, assignment_id, connection_id, projection_id, external_visit_id,
    previous_technician_id, technician_id, technician_display_name, actor, source_observed_at
  ) values (
    p_client_request_id, assignment_row.id, projection_row.connection_id,
    projection_row.id, projection_row.external_visit_id, previous_id,
    technician_row.id, technician_row.display_name, trim(p_actor), projection_row.source_observed_at
  );

  return query select assignment_row.id, assignment_row.technician_id,
    assignment_row.technician_display_name, assignment_row.assigned_at, false;
end;
$$;

create or replace function public.record_homeatlas_technician_job_clock_action(
  p_action_id uuid,
  p_assignment_id uuid,
  p_grant_id uuid,
  p_actor_display_name text,
  p_action text
)
returns table(
  entry_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds bigint,
  started_by_display_name text,
  finished_by_display_name text,
  replayed boolean
)
language plpgsql security definer set search_path = public as $$
declare
  assignment_row public.homeatlas_technician_visit_assignments%rowtype;
  projection_row public.jobber_visit_projections%rowtype;
  clock_row public.homeatlas_technician_job_clocks%rowtype;
  did_replay boolean := false;
begin
  if p_action_id is null or p_assignment_id is null or p_grant_id is null
     or p_action not in ('start', 'finish') or nullif(trim(coalesce(p_actor_display_name, '')), '') is null then
    raise exception 'Choose a valid job clock action';
  end if;
  select * into assignment_row from public.homeatlas_technician_visit_assignments where id = p_assignment_id;
  if not found then raise exception 'This HomeAtlas assignment is no longer available'; end if;
  select * into projection_row from public.jobber_visit_projections where id = assignment_row.projection_id;
  if not found or projection_row.is_complete or projection_row.visit_status = 'REMOVED' then
    raise exception 'This Jobber visit is no longer active';
  end if;
  if projection_row.scheduled_start < now() - interval '7 days'
     or projection_row.scheduled_start > now() + interval '2 days' then
    raise exception 'This stop is outside the safe field-closeout window';
  end if;
  if not exists (
    select 1 from public.technician_access_grants grant_row
    where grant_row.id = p_grant_id and grant_row.status = 'active'
      and grant_row.session_expires_at > now()
      and grant_row.jobber_user_id = 'homeatlas:' || assignment_row.technician_id::text
      and grant_row.display_name = assignment_row.technician_display_name
      and grant_row.display_name = trim(p_actor_display_name)
  ) then raise exception 'This Jobber stop is not assigned to this Field Pass'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_assignment_id::text, 0));
  select * into clock_row from public.homeatlas_technician_job_clocks
  where assignment_id = p_assignment_id for update;
  if p_action = 'start' then
    if found then did_replay := true;
    else
      insert into public.homeatlas_technician_job_clocks (
        id, assignment_id, external_visit_id, started_by_access_grant_id, started_by_display_name
      ) values (
        p_action_id, assignment_row.id, assignment_row.external_visit_id,
        p_grant_id, assignment_row.technician_display_name
      ) returning * into clock_row;
    end if;
  else
    if not found then raise exception 'Start the job clock before finishing this visit'; end if;
    if clock_row.ended_at is not null then did_replay := true;
    else
      if not exists (select 1 from public.homeatlas_technician_job_closeouts where assignment_id = p_assignment_id) then
        raise exception 'Save the HomeAtlas closeout before clocking out';
      end if;
      update public.homeatlas_technician_job_clocks set
        ended_at = now(), finish_action_id = p_action_id,
        finished_by_access_grant_id = p_grant_id,
        finished_by_display_name = assignment_row.technician_display_name
      where id = clock_row.id returning * into clock_row;
    end if;
  end if;
  return query select clock_row.id, clock_row.started_at, clock_row.ended_at,
    case when clock_row.ended_at is null then null else floor(extract(epoch from (clock_row.ended_at - clock_row.started_at)))::bigint end,
    clock_row.started_by_display_name, clock_row.finished_by_display_name, did_replay;
end;
$$;

create or replace function public.commit_homeatlas_technician_job_closeout(
  p_field_record_id uuid,
  p_assignment_id uuid,
  p_grant_id uuid,
  p_technician_name text,
  p_visit_date date,
  p_customer_summary text,
  p_internal_note text,
  p_follow_up_needed boolean,
  p_scope_read_state text,
  p_service_scope jsonb,
  p_scope_exception text,
  p_assets jsonb
)
returns table(field_record_id uuid, closeout_id uuid, asset_count integer)
language plpgsql security definer set search_path = public as $$
declare
  assignment_row public.homeatlas_technician_visit_assignments%rowtype;
  projection_row public.jobber_visit_projections%rowtype;
  closeout_row public.homeatlas_technician_job_closeouts%rowtype;
  asset jsonb;
begin
  select * into assignment_row from public.homeatlas_technician_visit_assignments where id = p_assignment_id;
  if not found then raise exception 'This HomeAtlas assignment is no longer available'; end if;
  select * into projection_row from public.jobber_visit_projections where id = assignment_row.projection_id;
  if not found or projection_row.visit_status = 'REMOVED' then raise exception 'This Jobber visit is no longer active'; end if;
  if projection_row.scheduled_start < now() - interval '7 days'
     or projection_row.scheduled_start > now() + interval '2 days' then
    raise exception 'This stop is outside the safe field-closeout window';
  end if;
  if not exists (
    select 1 from public.technician_access_grants grant_row
    where grant_row.id = p_grant_id and grant_row.status = 'active'
      and grant_row.session_expires_at > now()
      and grant_row.jobber_user_id = 'homeatlas:' || assignment_row.technician_id::text
      and grant_row.display_name = assignment_row.technician_display_name
      and grant_row.display_name = trim(p_technician_name)
  ) then raise exception 'This Jobber stop is not assigned to this Field Pass'; end if;
  if not exists (
    select 1 from public.homeatlas_technician_job_clocks
    where assignment_id = p_assignment_id and ended_at is null
  ) then raise exception 'Start the job clock at the property before documenting this visit'; end if;

  select * into closeout_row from public.homeatlas_technician_job_closeouts closeout_lookup
  where closeout_lookup.field_record_id = p_field_record_id;
  if found then
    return query select closeout_row.field_record_id, closeout_row.id,
      (select count(*)::integer from public.homeatlas_technician_job_photos photo_lookup where photo_lookup.field_record_id = closeout_row.field_record_id);
    return;
  end if;
  if exists (select 1 from public.homeatlas_technician_job_closeouts where assignment_id = p_assignment_id) then
    raise exception 'This visit already has a HomeAtlas closeout';
  end if;

  insert into public.homeatlas_technician_job_closeouts (
    field_record_id, assignment_id, external_visit_id, technician_id,
    technician_display_name, visit_date, customer_summary, internal_note,
    follow_up_needed, scope_read_state, service_scope, scope_exception
  ) values (
    p_field_record_id, assignment_row.id, assignment_row.external_visit_id,
    assignment_row.technician_id, assignment_row.technician_display_name,
    p_visit_date, left(coalesce(p_customer_summary, ''), 1200),
    left(coalesce(p_internal_note, ''), 2500), coalesce(p_follow_up_needed, false),
    p_scope_read_state, p_service_scope, left(coalesce(p_scope_exception, ''), 1200)
  ) returning * into closeout_row;

  for asset in select * from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) loop
    insert into public.homeatlas_technician_job_photos (
      field_record_id, client_id, storage_path, mime_type, size_bytes,
      capture_type, customer_visible
    ) values (
      p_field_record_id, (asset->>'clientId')::uuid, asset->>'storagePath',
      asset->>'mimeType', (asset->>'sizeBytes')::integer,
      asset->>'captureType', coalesce((asset->>'customerVisible')::boolean, false)
    );
  end loop;

  return query select closeout_row.field_record_id, closeout_row.id,
    jsonb_array_length(coalesce(p_assets, '[]'::jsonb));
end;
$$;

revoke all on function public.assign_homeatlas_technician_visit(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_homeatlas_technician_job_clock_action(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.commit_homeatlas_technician_job_closeout(uuid, uuid, uuid, text, date, text, text, boolean, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.assign_homeatlas_technician_visit(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.record_homeatlas_technician_job_clock_action(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.commit_homeatlas_technician_job_closeout(uuid, uuid, uuid, text, date, text, text, boolean, text, jsonb, text, jsonb) to service_role;
revoke execute on function public.reject_homeatlas_technician_assignment_event_change() from public, anon, authenticated, service_role;

comment on table public.homeatlas_technician_visit_assignments is
  'HomeAtlas staffing assignment for an exact Jobber-scheduled visit; never appointment or schedule authority.';
comment on table public.homeatlas_technician_job_closeouts is
  'Private technician closeout for Jobber visits that are not yet paired to a member property.';

commit;
