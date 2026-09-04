begin;
-- Serialize execution with Dispatch reassignment using the same assignment row lock.
-- A committed closeout can be replayed after clock-out, but never for another job.
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
  select * into assignment_row from public.homeatlas_technician_visit_assignments where id = p_assignment_id for update;
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
  select * into assignment_row from public.homeatlas_technician_visit_assignments where id = p_assignment_id for update;
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

  select * into closeout_row from public.homeatlas_technician_job_closeouts closeout_lookup
  where closeout_lookup.field_record_id = p_field_record_id;
  if found then
    if closeout_row.assignment_id <> p_assignment_id then
      raise exception 'This closeout request belongs to another assignment';
    end if;
    return query select closeout_row.field_record_id, closeout_row.id,
      (select count(*)::integer from public.homeatlas_technician_job_photos photo_lookup where photo_lookup.field_record_id = closeout_row.field_record_id);
    return;
  end if;
  if exists (select 1 from public.homeatlas_technician_job_closeouts where assignment_id = p_assignment_id) then
    raise exception 'This visit already has a HomeAtlas closeout';
  end if;

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


commit;
