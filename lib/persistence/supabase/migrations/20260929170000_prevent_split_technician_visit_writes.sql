-- One verified Jobber visit must not acquire both a legacy member field record
-- and a HomeAtlas-native technician assignment. The RPC preflight alone can
-- race; these triggers serialize both paths on the external Jobber visit ID.
begin;

create or replace function public.guard_homeatlas_field_visit_mode()
returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  visit_external_id text;
begin
  if tg_table_name = 'property_assessments' then
    if new.field_record_id is null or new.visit_id is null then
      return new;
    end if;
    select appointment.external_id into visit_external_id
    from public.member_appointments appointment
    where appointment.id = new.visit_id and appointment.provider = 'jobber';
  else
    visit_external_id := new.external_visit_id;
  end if;

  if nullif(trim(coalesce(visit_external_id, '')), '') is null then
    return new;
  end if;

  -- Assignment RPCs lock the projection first; legacy RPCs do not lock it.
  -- No legacy path waits on that row, so this ordering cannot deadlock them.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('homeatlas:field-visit:squeegeeking:' || visit_external_id, 0)
  );

  if tg_table_name = 'homeatlas_technician_visit_assignments' then
    if new.connection_id <> 'squeegeeking' then
      return new;
    end if;
    if exists (
      select 1 from public.technician_job_time_entries clock_entry
      where clock_entry.external_visit_id = visit_external_id
    ) or exists (
      select 1 from public.technician_visit_events route_event
      where route_event.external_visit_id = visit_external_id
    ) or exists (
      select 1 from public.property_assessments assessment
      join public.member_appointments appointment on appointment.id = assessment.visit_id
      where appointment.provider = 'jobber'
        and appointment.external_id = visit_external_id
        and assessment.field_record_id is not null
    ) then
      raise exception 'This Jobber visit already has legacy field activity; review it before assigning in HomeAtlas';
    end if;
  elsif exists (
    select 1 from public.homeatlas_technician_visit_assignments assignment
    where assignment.connection_id = 'squeegeeking'
      and assignment.external_visit_id = visit_external_id
  ) then
    raise exception 'This Jobber visit is assigned in HomeAtlas; use its assigned-job workflow';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_homeatlas_field_visit_mode()
  from public, anon, authenticated, service_role;

create trigger guard_homeatlas_native_field_mode
  before insert or update of external_visit_id, connection_id, projection_id
  on public.homeatlas_technician_visit_assignments
  for each row execute function public.guard_homeatlas_field_visit_mode();

create trigger guard_homeatlas_legacy_clock_mode
  before insert or update on public.technician_job_time_entries
  for each row execute function public.guard_homeatlas_field_visit_mode();

create trigger guard_homeatlas_legacy_route_mode
  before insert or update on public.technician_visit_events
  for each row execute function public.guard_homeatlas_field_visit_mode();

create trigger guard_homeatlas_legacy_closeout_mode
  before insert or update of field_record_id, visit_id
  on public.property_assessments
  for each row execute function public.guard_homeatlas_field_visit_mode();

commit;
