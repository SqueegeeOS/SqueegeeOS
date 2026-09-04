-- Transaction-only integration rehearsal. Never commit these fixtures.
begin;
do $$
<<rehearsal>>
declare
  tech_id uuid := gen_random_uuid();
  grant_id uuid := gen_random_uuid();
  projection_id uuid := gen_random_uuid();
  assignment_id uuid;
  request_id uuid := gen_random_uuid();
  record_id uuid := gen_random_uuid();
  result_row record;
  blocked boolean;
begin
  insert into public.homeatlas_technicians(id,display_name,phone_e164)
  values(tech_id,'Internal field rehearsal','+12025550199');
  insert into public.technician_access_grants(id,jobber_user_id,display_name,status,invite_token_hash,invite_expires_at,session_token_hash,session_expires_at,claimed_at,issued_by)
  values(grant_id,'homeatlas:'||tech_id::text,'Internal field rehearsal','active',
    encode(gen_random_bytes(32),'hex'),now()+interval '1 hour',
    encode(gen_random_bytes(32),'hex'),now()+interval '1 hour',now(),'Internal transaction rehearsal');
  insert into public.jobber_visit_projections(id,connection_id,external_visit_id,external_job_id,external_client_id,external_property_id,client_name,visit_status,is_complete,scheduled_start,raw_payload,source_payload_hash,source_observed_at)
  values(projection_id,'squeegeeking','rehearsal:'||projection_id,'rehearsal-job','rehearsal-client','rehearsal-property','Internal test - not a customer','SCHEDULED',false,now()+interval '1 hour','{}',repeat('a',64),now());
  select * into result_row from public.assign_homeatlas_technician_visit(request_id,projection_id,tech_id,null,'Internal rehearsal');
  assignment_id := result_row.assignment_id;
  if assignment_id is null then raise exception 'Assignment not created'; end if;
  select * into result_row from public.assign_homeatlas_technician_visit(request_id,projection_id,tech_id,null,'Internal rehearsal');
  if not result_row.replayed then raise exception 'Assignment retry not replayed'; end if;

  blocked := false;
  begin
    perform public.record_homeatlas_technician_job_clock_action(gen_random_uuid(),assignment_id,gen_random_uuid(),'Wrong technician','start');
  exception when others then
    if sqlerrm not like '%not assigned%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Wrong technician was accepted'; end if;

  perform public.record_homeatlas_technician_job_clock_action(gen_random_uuid(),assignment_id,grant_id,'Internal field rehearsal','start');
  select * into result_row from public.record_homeatlas_technician_job_clock_action(gen_random_uuid(),assignment_id,grant_id,'Internal field rehearsal','start');
  if not result_row.replayed then raise exception 'Duplicate clock-in was not replayed'; end if;
  blocked := false;
  begin
    perform public.record_homeatlas_technician_job_clock_action(gen_random_uuid(),assignment_id,grant_id,'Internal field rehearsal','finish');
  exception when others then
    if sqlerrm not like '%Save the HomeAtlas closeout%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Clock-out accepted without proof'; end if;
  perform public.commit_homeatlas_technician_job_closeout(record_id,assignment_id,grant_id,'Internal field rehearsal',current_date,'Internal rehearsal summary','Private owner note',true,'available','[]','Review requested','[]');
  perform public.record_homeatlas_technician_job_clock_action(gen_random_uuid(),assignment_id,grant_id,'Internal field rehearsal','finish');
  select * into result_row from public.commit_homeatlas_technician_job_closeout(record_id,assignment_id,grant_id,'Internal field rehearsal',current_date,'Internal rehearsal summary','Private owner note',true,'available','[]','Review requested','[]');
  if result_row.field_record_id <> record_id then raise exception 'Closeout replay mismatch'; end if;
  if (select count(*) from public.homeatlas_technician_job_closeouts c where c.assignment_id = rehearsal.assignment_id) <> 1 then raise exception 'Duplicate closeout'; end if;
  if (select count(*) from public.homeatlas_technician_job_clocks c where c.assignment_id = rehearsal.assignment_id) <> 1 then raise exception 'Duplicate clock'; end if;
  if (select is_complete from public.jobber_visit_projections where id=projection_id) then raise exception 'Jobber authority changed'; end if;
end;
$$;
select 'assignment, scope denial, clock-in replay, finish guard, closeout, clock-out and closeout replay passed; fixtures rolled back' as rehearsal;
rollback;
