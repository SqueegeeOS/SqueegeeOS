begin;

do $$
begin
  if exists (
    select 1 from public.jobber_connections
    where id = 'squeegeeking'
      and account_id is distinct from 'disposable-concurrency-043'
  ) then
    raise exception 'Refusing to clean a non-harness squeegeeking connection';
  end if;
end;
$$;

-- The acknowledged disposable harness must remove its committed synthetic
-- immutable evidence between race cases. Replica mode is transaction-local
-- and every predicate is bound to the reserved fixture identities.
set local session_replication_role = replica;

delete from public.visit_text_evidence
where appointment_id = 'a0000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_completion_events
where appointment_id = 'a0000000-0000-4000-8000-000000000043';
delete from public.appointment_source_events
where appointment_id = 'a0000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_classification_events
where classification_id = '90000000-0000-4000-8000-000000000043';
delete from public.member_appointments
where id = 'a0000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_classifications
where id = '90000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_projection_events
where projection_id = '70000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_source_observations
where run_id in (
  'b0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000044'
);
delete from public.jobber_schedule_sync_partitions
where run_id in (
  'b0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000044'
);
delete from public.jobber_schedule_sync_watermarks
where connection_id = 'squeegeeking';
delete from public.jobber_schedule_sync_locks
where connection_id = 'squeegeeking';
delete from public.jobber_schedule_sync_runs
where id in (
  'b0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000043',
  'f0000000-0000-4000-8000-000000000044'
) or actor_id = '10000000-0000-4000-8000-000000000043';
delete from public.jobber_property_link_events
where link_id = '80000000-0000-4000-8000-000000000043';
delete from public.jobber_property_links
where id = '80000000-0000-4000-8000-000000000043';
delete from public.jobber_visit_projections
where id = '70000000-0000-4000-8000-000000000043';
delete from public.jobber_connection_events
where connection_id = 'squeegeeking'
  and exists (
    select 1 from public.jobber_connections
    where id = 'squeegeeking'
      and account_id = 'disposable-concurrency-043'
  );
delete from public.jobber_connections
where id = 'squeegeeking'
  and account_id = 'disposable-concurrency-043';
delete from public.member_profiles
where id = '60000000-0000-4000-8000-000000000043';
delete from public.signed_agreements
where id = '50000000-0000-4000-8000-000000000043';
delete from public.memberships
where id = '40000000-0000-4000-8000-000000000043';
delete from public.properties
where id = '30000000-0000-4000-8000-000000000043';
delete from public.homeowners
where id = '20000000-0000-4000-8000-000000000043';
delete from public.hq_admin_user_events
where subject_user_id = '10000000-0000-4000-8000-000000000043';
delete from public.hq_admin_users
where user_id = '10000000-0000-4000-8000-000000000043';
delete from auth.users
where id = '10000000-0000-4000-8000-000000000043';

commit;
