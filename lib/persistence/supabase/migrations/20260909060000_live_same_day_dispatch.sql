-- Same-day HomeAtlas live dispatch.
-- A field assignment may begin before Jobber has mirrored the visit, use the
-- existing native clock/closeout ledger, and later attach to the verified
-- Jobber projection without creating a second technician job.

begin;

alter table public.homeatlas_technician_visit_assignments
  alter column projection_id drop not null;

alter table public.homeatlas_technician_visit_assignment_events
  alter column projection_id drop not null;

alter table public.homeatlas_technician_visit_assignments
  add column if not exists source_kind text not null default 'jobber',
  add column if not exists sync_state text not null default 'verified',
  add column if not exists live_client_name text,
  add column if not exists live_service_title text,
  add column if not exists live_property_address text,
  add column if not exists live_scheduled_start timestamptz,
  add column if not exists live_sold_amount_cents integer,
  add column if not exists live_notes text,
  add column if not exists live_service_scope jsonb not null default '[]'::jsonb,
  add column if not exists reconciled_at timestamptz;

alter table public.homeatlas_technician_visit_assignments
  drop constraint if exists homeatlas_technician_visit_assignments_source_kind_check,
  drop constraint if exists homeatlas_technician_visit_assignments_sync_state_check,
  drop constraint if exists homeatlas_technician_visit_assignments_live_shape_check,
  drop constraint if exists homeatlas_technician_visit_assignments_live_amount_check,
  drop constraint if exists homeatlas_technician_visit_assignments_live_scope_check;

alter table public.homeatlas_technician_visit_assignments
  add constraint homeatlas_technician_visit_assignments_source_kind_check
    check (source_kind in ('jobber', 'live')),
  add constraint homeatlas_technician_visit_assignments_sync_state_check
    check (sync_state in ('pending_sync', 'verified')),
  add constraint homeatlas_technician_visit_assignments_live_amount_check
    check (live_sold_amount_cents is null or live_sold_amount_cents between 0 and 100000000),
  add constraint homeatlas_technician_visit_assignments_live_scope_check
    check (jsonb_typeof(live_service_scope) = 'array'),
  add constraint homeatlas_technician_visit_assignments_live_shape_check
    check (
      (
        source_kind = 'jobber'
        and sync_state = 'verified'
        and projection_id is not null
      )
      or
      (
        source_kind = 'live'
        and live_scheduled_start is not null
        and nullif(trim(coalesce(live_client_name, '')), '') is not null
        and char_length(live_client_name) <= 120
        and nullif(trim(coalesce(live_service_title, '')), '') is not null
        and char_length(live_service_title) <= 160
        and char_length(coalesce(live_property_address, '')) <= 320
        and char_length(coalesce(live_notes, '')) <= 1000
        and (
          (sync_state = 'pending_sync' and projection_id is null and reconciled_at is null)
          or
          (sync_state = 'verified' and projection_id is not null and reconciled_at is not null)
        )
      )
    );

create index if not exists homeatlas_technician_live_pending_idx
  on public.homeatlas_technician_visit_assignments(
    technician_id,
    live_scheduled_start desc
  )
  where source_kind = 'live' and sync_state = 'pending_sync';

create index if not exists homeatlas_technician_live_source_idx
  on public.homeatlas_technician_visit_assignments(
    technician_id,
    assigned_at desc
  )
  where source_kind = 'live';

create or replace function public.create_live_homeatlas_technician_job(
  p_client_request_id uuid,
  p_technician_id uuid,
  p_scheduled_start timestamptz,
  p_client_name text,
  p_service_title text,
  p_property_address text,
  p_sold_amount_cents integer,
  p_notes text,
  p_actor text
)
returns table(
  assignment_id uuid,
  technician_id uuid,
  technician_display_name text,
  external_visit_id text,
  scheduled_start timestamptz,
  replayed boolean
)
language plpgsql security definer set search_path = public as $$
declare
  technician_row public.homeatlas_technicians%rowtype;
  assignment_row public.homeatlas_technician_visit_assignments%rowtype;
  prior_event public.homeatlas_technician_visit_assignment_events%rowtype;
  new_assignment_id uuid;
  synthetic_external_id text;
  service_scope jsonb;
begin
  if p_client_request_id is null or p_technician_id is null or p_scheduled_start is null
     or nullif(trim(coalesce(p_client_name, '')), '') is null
     or char_length(trim(p_client_name)) > 120
     or nullif(trim(coalesce(p_service_title, '')), '') is null
     or char_length(trim(p_service_title)) > 160
     or char_length(trim(coalesce(p_property_address, ''))) > 320
     or char_length(trim(coalesce(p_notes, ''))) > 1000
     or (p_sold_amount_cents is not null and (p_sold_amount_cents < 0 or p_sold_amount_cents > 100000000))
     or nullif(trim(coalesce(p_actor, '')), '') is null
     or char_length(trim(p_actor)) > 100 then
    raise exception 'Enter a valid live dispatch job';
  end if;
  if p_scheduled_start < now() - interval '2 days'
     or p_scheduled_start > now() + interval '2 days' then
    raise exception 'Live dispatch is limited to the current field window';
  end if;

  select * into prior_event
  from public.homeatlas_technician_visit_assignment_events
  where client_request_id = p_client_request_id;
  if found then
    select * into assignment_row
    from public.homeatlas_technician_visit_assignments
    where id = prior_event.assignment_id;
    if not found or assignment_row.source_kind <> 'live'
       or assignment_row.technician_id <> p_technician_id then
      raise exception 'This live dispatch request belongs to another assignment';
    end if;
    return query select assignment_row.id, assignment_row.technician_id,
      assignment_row.technician_display_name, assignment_row.external_visit_id,
      assignment_row.live_scheduled_start, true;
    return;
  end if;

  select * into technician_row
  from public.homeatlas_technicians
  where id = p_technician_id and status = 'active';
  if not found then raise exception 'Choose an active HomeAtlas technician'; end if;

  new_assignment_id := gen_random_uuid();
  synthetic_external_id := 'homeatlas-live:' || new_assignment_id::text;
  service_scope := jsonb_build_array(
    jsonb_build_object(
      'id', 'live-service:' || new_assignment_id::text,
      'name', trim(p_service_title),
      'description', null,
      'quantity', 1,
      'category', 'Live dispatch'
    )
  );

  insert into public.homeatlas_technician_visit_assignments (
    id, connection_id, projection_id, external_visit_id,
    technician_id, technician_display_name, assigned_by,
    source_kind, sync_state, live_client_name, live_service_title,
    live_property_address, live_scheduled_start, live_sold_amount_cents,
    live_notes, live_service_scope
  ) values (
    new_assignment_id, 'squeegeeking', null, synthetic_external_id,
    technician_row.id, technician_row.display_name, trim(p_actor),
    'live', 'pending_sync', trim(p_client_name), trim(p_service_title),
    nullif(trim(coalesce(p_property_address, '')), ''), p_scheduled_start,
    p_sold_amount_cents, nullif(trim(coalesce(p_notes, '')), ''), service_scope
  ) returning * into assignment_row;

  insert into public.homeatlas_technician_visit_assignment_events (
    client_request_id, assignment_id, connection_id, projection_id,
    external_visit_id, previous_technician_id, technician_id,
    technician_display_name, actor, source_observed_at
  ) values (
    p_client_request_id, assignment_row.id, assignment_row.connection_id, null,
    assignment_row.external_visit_id, null, assignment_row.technician_id,
    assignment_row.technician_display_name, trim(p_actor), null
  );

  return query select assignment_row.id, assignment_row.technician_id,
    assignment_row.technician_display_name, assignment_row.external_visit_id,
    assignment_row.live_scheduled_start, false;
end;
$$;

create or replace function public.reconcile_live_homeatlas_technician_job(
  p_assignment_id uuid,
  p_projection_id uuid,
  p_actor text
)
returns table(
  assignment_id uuid,
  external_visit_id text,
  reconciled_at timestamptz,
  replayed boolean
)
language plpgsql security definer set search_path = public as $$
declare
  assignment_row public.homeatlas_technician_visit_assignments%rowtype;
  projection_row public.jobber_visit_projections%rowtype;
  did_replay boolean := false;
begin
  if p_assignment_id is null or p_projection_id is null
     or nullif(trim(coalesce(p_actor, '')), '') is null
     or char_length(trim(p_actor)) > 100 then
    raise exception 'Choose a valid live job and Jobber visit';
  end if;

  select * into assignment_row
  from public.homeatlas_technician_visit_assignments
  where id = p_assignment_id
  for update;
  if not found or assignment_row.source_kind <> 'live' then
    raise exception 'This HomeAtlas live job is no longer available';
  end if;
  if assignment_row.sync_state = 'verified' then
    if assignment_row.projection_id = p_projection_id then
      did_replay := true;
      return query select assignment_row.id, assignment_row.external_visit_id,
        assignment_row.reconciled_at, did_replay;
      return;
    end if;
    raise exception 'This live job is already linked to another Jobber visit';
  end if;

  select * into projection_row
  from public.jobber_visit_projections
  where id = p_projection_id and connection_id = 'squeegeeking'
  for update;
  if not found or projection_row.visit_status = 'REMOVED' then
    raise exception 'That Jobber visit is no longer available';
  end if;
  if abs(extract(epoch from (projection_row.scheduled_start - assignment_row.live_scheduled_start))) > 43200 then
    raise exception 'The Jobber visit is outside the live-job matching window';
  end if;
  if lower(trim(projection_row.client_name)) <> lower(trim(assignment_row.live_client_name)) then
    raise exception 'The Jobber visit client does not match the live job';
  end if;
  if assignment_row.live_property_address is null
     and lower(trim(coalesce(projection_row.title, ''))) <> lower(trim(assignment_row.live_service_title)) then
    raise exception 'The Jobber visit service does not match the live job';
  end if;
  if exists (
    select 1 from public.homeatlas_technician_visit_assignments existing
    where existing.projection_id = p_projection_id and existing.id <> assignment_row.id
  ) then
    raise exception 'That Jobber visit already has a HomeAtlas field assignment';
  end if;

  update public.homeatlas_technician_visit_assignments
  set projection_id = projection_row.id,
      external_visit_id = projection_row.external_visit_id,
      sync_state = 'verified',
      reconciled_at = now(),
      updated_at = now()
  where id = assignment_row.id
  returning * into assignment_row;

  update public.homeatlas_technician_job_clocks
  set external_visit_id = projection_row.external_visit_id
  where assignment_id = assignment_row.id;

  update public.homeatlas_technician_job_closeouts
  set external_visit_id = projection_row.external_visit_id
  where assignment_id = assignment_row.id;

  insert into public.homeatlas_technician_visit_assignment_events (
    client_request_id, assignment_id, connection_id, projection_id,
    external_visit_id, previous_technician_id, technician_id,
    technician_display_name, actor, source_observed_at
  ) values (
    gen_random_uuid(), assignment_row.id, assignment_row.connection_id,
    projection_row.id, projection_row.external_visit_id, null,
    assignment_row.technician_id, assignment_row.technician_display_name,
    trim(p_actor), projection_row.source_observed_at
  );

  return query select assignment_row.id, assignment_row.external_visit_id,
    assignment_row.reconciled_at, false;
end;
$$;

-- Native clocking now accepts either a verified Jobber-backed assignment or a
-- same-day HomeAtlas live assignment that is still waiting for Jobber sync.
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
  effective_start timestamptz;
  did_replay boolean := false;
begin
  if p_action_id is null or p_assignment_id is null or p_grant_id is null
     or p_action not in ('start', 'finish') or nullif(trim(coalesce(p_actor_display_name, '')), '') is null then
    raise exception 'Choose a valid job clock action';
  end if;
  select * into assignment_row
  from public.homeatlas_technician_visit_assignments
  where id = p_assignment_id for update;
  if not found then raise exception 'This HomeAtlas assignment is no longer available'; end if;

  if assignment_row.projection_id is not null then
    select * into projection_row
    from public.jobber_visit_projections
    where id = assignment_row.projection_id;
    if not found or projection_row.visit_status = 'REMOVED' then
      raise exception 'This Jobber visit is no longer active';
    end if;
    effective_start := projection_row.scheduled_start;
  elsif assignment_row.source_kind = 'live'
        and assignment_row.sync_state = 'pending_sync'
        and assignment_row.live_scheduled_start is not null then
    effective_start := assignment_row.live_scheduled_start;
  else
    raise exception 'This HomeAtlas assignment no longer has an active field job';
  end if;

  if effective_start < now() - interval '7 days'
     or effective_start > now() + interval '2 days' then
    raise exception 'This stop is outside the safe field-closeout window';
  end if;
  if not exists (
    select 1 from public.technician_access_grants grant_row
    where grant_row.id = p_grant_id and grant_row.status = 'active'
      and grant_row.session_expires_at > now()
      and grant_row.jobber_user_id = 'homeatlas:' || assignment_row.technician_id::text
      and grant_row.display_name = assignment_row.technician_display_name
      and grant_row.display_name = trim(p_actor_display_name)
  ) then raise exception 'This job is not assigned to this Field Pass'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_assignment_id::text, 0));
  select * into clock_row
  from public.homeatlas_technician_job_clocks
  where assignment_id = p_assignment_id for update;
  if p_action = 'start' then
    if found then did_replay := true;
    else
      insert into public.homeatlas_technician_job_clocks (
        id, assignment_id, external_visit_id,
        started_by_access_grant_id, started_by_display_name
      ) values (
        p_action_id, assignment_row.id, assignment_row.external_visit_id,
        p_grant_id, assignment_row.technician_display_name
      ) returning * into clock_row;
    end if;
  else
    if not found then raise exception 'Start the job clock before finishing this visit'; end if;
    if clock_row.ended_at is not null then did_replay := true;
    else
      if not exists (
        select 1 from public.homeatlas_technician_job_closeouts
        where assignment_id = p_assignment_id
      ) then
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
    case when clock_row.ended_at is null then null
      else floor(extract(epoch from (clock_row.ended_at - clock_row.started_at)))::bigint end,
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
  effective_start timestamptz;
  asset jsonb;
begin
  select * into assignment_row
  from public.homeatlas_technician_visit_assignments
  where id = p_assignment_id for update;
  if not found then raise exception 'This HomeAtlas assignment is no longer available'; end if;

  if assignment_row.projection_id is not null then
    select * into projection_row
    from public.jobber_visit_projections
    where id = assignment_row.projection_id;
    if not found or projection_row.visit_status = 'REMOVED' then
      raise exception 'This Jobber visit is no longer active';
    end if;
    effective_start := projection_row.scheduled_start;
  elsif assignment_row.source_kind = 'live'
        and assignment_row.sync_state = 'pending_sync'
        and assignment_row.live_scheduled_start is not null then
    effective_start := assignment_row.live_scheduled_start;
  else
    raise exception 'This HomeAtlas assignment no longer has an active field job';
  end if;

  if effective_start < now() - interval '7 days'
     or effective_start > now() + interval '2 days' then
    raise exception 'This stop is outside the safe field-closeout window';
  end if;
  if not exists (
    select 1 from public.technician_access_grants grant_row
    where grant_row.id = p_grant_id and grant_row.status = 'active'
      and grant_row.session_expires_at > now()
      and grant_row.jobber_user_id = 'homeatlas:' || assignment_row.technician_id::text
      and grant_row.display_name = assignment_row.technician_display_name
      and grant_row.display_name = trim(p_technician_name)
  ) then raise exception 'This job is not assigned to this Field Pass'; end if;

  select * into closeout_row
  from public.homeatlas_technician_job_closeouts closeout_lookup
  where closeout_lookup.field_record_id = p_field_record_id;
  if found then
    if closeout_row.assignment_id <> p_assignment_id then
      raise exception 'This closeout request belongs to another assignment';
    end if;
    return query select closeout_row.field_record_id, closeout_row.id,
      (select count(*)::integer
       from public.homeatlas_technician_job_photos photo_lookup
       where photo_lookup.field_record_id = closeout_row.field_record_id);
    return;
  end if;
  if exists (
    select 1 from public.homeatlas_technician_job_closeouts
    where assignment_id = p_assignment_id
  ) then raise exception 'This visit already has a HomeAtlas closeout'; end if;

  if not exists (
    select 1 from public.homeatlas_technician_job_clocks
    where assignment_id = p_assignment_id and ended_at is null
  ) then raise exception 'Start the job clock at the property before documenting this visit'; end if;

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

revoke all on function public.create_live_homeatlas_technician_job(
  uuid, uuid, timestamptz, text, text, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.create_live_homeatlas_technician_job(
  uuid, uuid, timestamptz, text, text, text, integer, text, text
) to service_role;

revoke all on function public.reconcile_live_homeatlas_technician_job(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.reconcile_live_homeatlas_technician_job(
  uuid, uuid, text
) to service_role;

commit;
