-- Run against a migrated database. All synthetic records are rolled back.
begin;
set local role service_role;
do $$
declare
  v_id uuid;
  v_external text;
  case_name text;
  tech_id uuid;
  assignment_before uuid;
  audit_before bigint;
  start_at timestamptz;
  status_text text;
  job_status_text text;
  complete_flag boolean;
  expected boolean;
begin
  select id into strict tech_id from public.homeatlas_technicians
    where display_name='Tyler Germany' and status='active';

  foreach case_name in array array['booked','same_day','past','complete','removed','archived','unscheduled'] loop
    v_id := gen_random_uuid();
    v_external := 'auto-dispatch-verification:' || v_id::text;
    start_at := now() + interval '1 day';
    status_text := 'UPCOMING'; job_status_text := 'upcoming'; complete_flag := false;
    expected := case_name in ('booked','same_day');
    if case_name='same_day' then
      start_at := date_trunc('day',now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
      status_text := 'TODAY';
    elsif case_name='past' then start_at := now() - interval '2 days';
    elsif case_name='complete' then complete_flag:=true; status_text:='COMPLETED';
    elsif case_name='removed' then status_text:='REMOVED';
    elsif case_name='archived' then job_status_text:='archived';
    elsif case_name='unscheduled' then start_at:=null; status_text:='UNSCHEDULED';
    end if;

    insert into public.jobber_visit_projections (
      id,connection_id,external_visit_id,external_job_id,external_client_id,
      external_property_id,client_name,title,visit_status,job_status,is_complete,
      scheduled_start,raw_payload,source_payload_hash,source_observed_at
    ) values (
      v_id,'squeegeeking',v_external,v_external,v_external,v_external,
      'Automatic Dispatch Verification','Verification',status_text,job_status_text,
      complete_flag,start_at,'{}',repeat('a',64),now()
    );
    if exists(select 1 from public.homeatlas_technician_visit_assignments
        where projection_id=v_id and technician_id=tech_id) is distinct from expected then
      raise exception 'Dispatch case failed: %',case_name;
    end if;
    if case_name='booked' then
      select id into assignment_before from public.homeatlas_technician_visit_assignments where projection_id=v_id;
      select count(*) into audit_before from public.homeatlas_technician_visit_assignment_events where projection_id=v_id;
      update public.jobber_visit_projections set scheduled_start=scheduled_start + interval '1 hour' where id=v_id;
      update public.jobber_visit_projections set visit_status=visit_status where id=v_id;
      if (select id from public.homeatlas_technician_visit_assignments where projection_id=v_id) is distinct from assignment_before
         or (select count(*) from public.homeatlas_technician_visit_assignment_events where projection_id=v_id) <> audit_before then
        raise exception 'Repeat sync or rescheduling duplicated the assignment/audit';
      end if;
    elsif case_name='unscheduled' then
      update public.jobber_visit_projections set scheduled_start=now()+interval '1 day',visit_status='UPCOMING' where id=v_id;
      if not exists(select 1 from public.homeatlas_technician_visit_assignments where projection_id=v_id and technician_id=tech_id) then
        raise exception 'Scheduling an existing visit did not dispatch';
      end if;
    end if;
  end loop;
  if has_function_privilege('anon','public.auto_dispatch_booked_homeatlas_visit(uuid)','execute')
     or has_function_privilege('authenticated','public.auto_dispatch_booked_homeatlas_visit(uuid)','execute') then
    raise exception 'Dispatch helper is publicly callable';
  end if;
end;
$$;
rollback;
select 'PASS: insert, scheduling, same-day booking, repeat sync, rescheduling, completed/removed/archived/past/unscheduled exclusions, service-role execution, public access checks; all test rows rolled back' as verification;
