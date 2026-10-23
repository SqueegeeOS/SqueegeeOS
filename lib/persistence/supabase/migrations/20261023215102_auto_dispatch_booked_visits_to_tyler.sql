-- Dispatch newly scheduled Jobber visits to Tyler's HomeAtlas technician suite.
-- Jobber remains the source of appointment dates, scope, and completion.
begin;

create or replace function public.auto_dispatch_booked_homeatlas_visit(p_projection_id uuid)
returns uuid
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  visit_row public.jobber_visit_projections%rowtype;
  tech_row public.homeatlas_technicians%rowtype;
  new_assignment_id uuid;
begin
  select * into visit_row from public.jobber_visit_projections
  where id = p_projection_id and connection_id = 'squeegeeking'
  for update;
  if not found or visit_row.scheduled_start is null
     or visit_row.scheduled_start < (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')
     or visit_row.is_complete
     or upper(coalesce(visit_row.visit_status, '')) in ('REMOVED', 'COMPLETED', 'CANCELLED', 'CANCELED', 'UNSCHEDULED')
     or lower(coalesce(visit_row.job_status, '')) in ('archived', 'cancelled', 'canceled') then
    return null;
  end if;

  -- Resolve the established active roster identity; never embed generated IDs.
  if (select count(*) from public.homeatlas_technicians
      where display_name = 'Tyler Germany' and status = 'active') <> 1 then
    return null;
  end if;
  select * into tech_row from public.homeatlas_technicians
  where display_name = 'Tyler Germany' and status = 'active';

  -- Match the existing field-mode guard's lock order.
  perform pg_advisory_xact_lock(hashtextextended(
    'homeatlas:field-visit:squeegeeking:' || visit_row.external_visit_id, 0));

  -- An explicit HQ assignment remains an override.
  if exists (select 1 from public.homeatlas_technician_visit_assignments
      where connection_id = visit_row.connection_id
        and external_visit_id = visit_row.external_visit_id) then
    return null;
  end if;

  -- Do not change execution modes for a stop already being worked.
  if exists (select 1 from public.technician_job_time_entries
      where external_visit_id = visit_row.external_visit_id)
     or exists (select 1 from public.technician_visit_events
      where external_visit_id = visit_row.external_visit_id)
     or exists (select 1 from public.property_assessments assessment
      join public.member_appointments appointment on appointment.id = assessment.visit_id
      where appointment.provider = 'jobber'
        and appointment.external_id = visit_row.external_visit_id
        and assessment.field_record_id is not null) then
    return null;
  end if;

  -- A possible matching live job is already dispatched. Leave its projection
  -- free for the existing conservative reconciliation instead of duplicating it.
  if exists (select 1 from public.homeatlas_technician_visit_assignments pending
      where pending.connection_id = visit_row.connection_id
        and pending.source_kind = 'live' and pending.sync_state = 'pending_sync'
        and trim(regexp_replace(lower(normalize(pending.live_client_name, NFKD)), '[^a-z0-9]+', ' ', 'g'))
          = trim(regexp_replace(lower(normalize(visit_row.client_name, NFKD)), '[^a-z0-9]+', ' ', 'g'))
        and pending.live_scheduled_start between visit_row.scheduled_start - interval '12 hours'
                                            and visit_row.scheduled_start + interval '12 hours') then
    return null;
  end if;

  insert into public.homeatlas_technician_visit_assignments (
    connection_id, projection_id, external_visit_id, technician_id,
    technician_display_name, assigned_by
  ) values (
    visit_row.connection_id, visit_row.id, visit_row.external_visit_id,
    tech_row.id, tech_row.display_name, 'HomeAtlas automatic dispatch'
  )
  on conflict do nothing
  returning id into new_assignment_id;

  if new_assignment_id is not null then
    insert into public.homeatlas_technician_visit_assignment_events (
      client_request_id, assignment_id, connection_id, projection_id,
      external_visit_id, previous_technician_id, technician_id,
      technician_display_name, actor, source_observed_at
    ) values (
      gen_random_uuid(), new_assignment_id, visit_row.connection_id,
      visit_row.id, visit_row.external_visit_id, null, tech_row.id,
      tech_row.display_name, 'HomeAtlas automatic dispatch', visit_row.source_observed_at
    );
  end if;
  return new_assignment_id;
end;
$$;

create or replace function public.auto_dispatch_booked_homeatlas_visit_trigger()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  perform public.auto_dispatch_booked_homeatlas_visit(new.id);
  return new;
end;
$$;

revoke all on function public.auto_dispatch_booked_homeatlas_visit(uuid) from public, anon, authenticated;
grant execute on function public.auto_dispatch_booked_homeatlas_visit(uuid) to service_role;
revoke all on function public.auto_dispatch_booked_homeatlas_visit_trigger() from public, anon, authenticated, service_role;

create trigger auto_dispatch_booked_homeatlas_visit
after insert or update of scheduled_start, visit_status, job_status, is_complete, client_name
on public.jobber_visit_projections
for each row execute function public.auto_dispatch_booked_homeatlas_visit_trigger();

-- Include today's remaining jobs and every already booked future visit.
select public.auto_dispatch_booked_homeatlas_visit(id)
from public.jobber_visit_projections
where connection_id = 'squeegeeking' and not is_complete
  and scheduled_start >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')
order by id;

commit;
