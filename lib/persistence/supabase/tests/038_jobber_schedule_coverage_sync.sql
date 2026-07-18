\set ON_ERROR_STOP on

-- Run only against a disposable Supabase database after migrations 001-038.
-- Every fixture and assertion is rolled back.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000138',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pr2-038@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '00000000-0000-0000-0000-000000000138',
  'pr2-038@example.invalid', 'operator', true
);
insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-account-038',
  'Disposable Jobber', 'not-a-real-token', 'not-a-real-token',
  now() + interval '1 hour', '2025-04-16'
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jobber_schedule_sync_runs',
    'jobber_schedule_sync_partitions',
    'jobber_visit_source_observations',
    'jobber_schedule_sync_watermarks',
    'jobber_schedule_sync_locks'
  ] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on %', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
    then
      raise exception 'anon/authenticated unexpectedly has table privilege on %', table_name;
    end if;
  end loop;
  if has_function_privilege(
    'authenticated',
    'public.begin_jobber_schedule_coverage_sync(uuid,text,uuid,timestamp with time zone,timestamp with time zone,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated unexpectedly executes Jobber coverage reservation';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.renew_jobber_schedule_coverage_sync_lease(uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reconcile_jobber_schedule_coverage_finalization(uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated unexpectedly executes Jobber coverage control RPCs';
  end if;
end;
$$;

-- Seed a prior immutable coverage watermark so a partial run can prove it is
-- byte-for-byte unchanged.
insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation,
  pass_one_manifest_sha256, pass_one_leaf_coverage_sha256,
  pass_one_leaf_count, pass_one_visit_count,
  pass_two_manifest_sha256, pass_two_leaf_coverage_sha256,
  pass_two_leaf_count, pass_two_visit_count,
  request_count, leaf_count, visit_count, completed_at
) values (
  '00000000-0000-0000-0000-000000000238', 'squeegeeking',
  '00000000-0000-0000-0000-000000000138', 'complete',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16', 0,
  repeat('1', 64), repeat('2', 64), 1, 0,
  repeat('1', 64), repeat('2', 64), 1, 0,
  2, 2, 0, now()
);
insert into public.jobber_schedule_sync_watermarks (
  connection_id, run_id, window_start, window_end, covered_at, generation
) values (
  'squeegeeking', '00000000-0000-0000-0000-000000000238',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', now(), 1
);

create temporary table pr2_watermark_before as
select to_jsonb(watermark) as snapshot
from public.jobber_schedule_sync_watermarks watermark
where connection_id = 'squeegeeking';

do $$
declare
  first_result jsonb;
  concurrent_result jsonb;
begin
  first_result := public.begin_jobber_schedule_coverage_sync(
    '00000000-0000-0000-0000-000000000338', 'squeegeeking',
    '00000000-0000-0000-0000-000000000138',
    '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
  );
  concurrent_result := public.begin_jobber_schedule_coverage_sync(
    '00000000-0000-0000-0000-000000000438', 'squeegeeking',
    '00000000-0000-0000-0000-000000000138',
    '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
  );
  if first_result->>'outcome' <> 'acquired'
    or concurrent_result->>'outcome' <> 'locked'
  then
    raise exception 'Concurrent Jobber sync lock was not rejected';
  end if;
end;
$$;

select public.append_jobber_schedule_coverage_leaf(
  '00000000-0000-0000-0000-000000000338', 1::smallint, 0,
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', repeat('a', 64),
  jsonb_build_array(jsonb_build_object(
    'external_visit_id', 'visit-038',
    'external_job_id', 'job-038',
    'external_client_id', 'client-038',
    'external_property_id', 'property-038',
    'jobber_property_web_uri', 'https://secure.getjobber.com/properties/038',
    'job_number', 38,
    'title', 'Disposable visit',
    'client_name', 'Disposable client',
    'visit_status', 'OPAQUE',
    'job_status', 'OPAQUE',
    'is_complete', false,
    'scheduled_start', '2026-07-16T19:00:00Z',
    'scheduled_end', null,
    'completed_at', null,
    'raw_payload', jsonb_build_object('id', 'visit-038'),
    'source_payload_hash', repeat('a', 64),
    'source_observed_at', '2026-07-16T18:00:00Z'
  ))
);

do $$
begin
  begin
    update public.jobber_visit_source_observations
    set source_payload_hash = repeat('b', 64)
    where run_id = '00000000-0000-0000-0000-000000000338';
    raise exception 'Immutable Jobber observation unexpectedly changed';
  exception when others then
    if sqlerrm not like '%append-only and immutable%' then raise; end if;
  end;
end;
$$;

select public.mark_jobber_schedule_coverage_sync_partial(
  '00000000-0000-0000-0000-000000000338', 'query_cap_reached', 2
);

do $$
begin
  if (select snapshot from pr2_watermark_before) is distinct from (
    select to_jsonb(watermark)
    from public.jobber_schedule_sync_watermarks watermark
    where connection_id = 'squeegeeking'
  ) then
    raise exception 'Partial run changed the prior watermark';
  end if;
end;
$$;

-- An expired worker cannot renew, and cannot resume after a replacement owns
-- the lock. This is the durable fence before every provider request.
select public.begin_jobber_schedule_coverage_sync(
  '00000000-0000-0000-0000-000000000738', 'squeegeeking',
  '00000000-0000-0000-0000-000000000138',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
);
update public.jobber_schedule_sync_locks
set lease_expires_at = now() - interval '1 second'
where connection_id = 'squeegeeking';
do $$
begin
  begin
    perform public.renew_jobber_schedule_coverage_sync_lease(
      '00000000-0000-0000-0000-000000000738'
    );
    raise exception 'Expired Jobber worker unexpectedly renewed its lease';
  exception when others then
    if sqlerrm not like '%lease was lost%' then raise; end if;
  end;
end;
$$;
select public.begin_jobber_schedule_coverage_sync(
  '00000000-0000-0000-0000-000000000838', 'squeegeeking',
  '00000000-0000-0000-0000-000000000138',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
);
do $$
begin
  begin
    perform public.renew_jobber_schedule_coverage_sync_lease(
      '00000000-0000-0000-0000-000000000738'
    );
    raise exception 'Replaced Jobber worker unexpectedly renewed its lease';
  exception when others then
    if sqlerrm not like '%lease was lost%' then raise; end if;
  end;
  if (select active_run_id from public.jobber_schedule_sync_locks
      where connection_id = 'squeegeeking') <>
      '00000000-0000-0000-0000-000000000838'::uuid then
    raise exception 'Replacement Jobber worker lost lock ownership';
  end if;
end;
$$;
select public.mark_jobber_schedule_coverage_sync_partial(
  '00000000-0000-0000-0000-000000000838', 'storage_failure', 0
);

-- Simulate an out-of-order finalizer by advancing the generation after its
-- reservation. CAS must reject it before any projection or watermark write.
select public.begin_jobber_schedule_coverage_sync(
  '00000000-0000-0000-0000-000000000638', 'squeegeeking',
  '00000000-0000-0000-0000-000000000138',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
);
select public.append_jobber_schedule_coverage_leaf(
  '00000000-0000-0000-0000-000000000638', pass_number, 0,
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', repeat('c', 64),
  '[]'::jsonb
)
from (values (1::smallint), (2::smallint)) passes(pass_number);
select public.complete_jobber_schedule_coverage_pass(
  '00000000-0000-0000-0000-000000000638', pass_number,
  repeat('c', 64), repeat('d', 64), 1, 0, 1
)
from (values (1::smallint), (2::smallint)) passes(pass_number);
update public.jobber_schedule_sync_watermarks
set generation = 2
where connection_id = 'squeegeeking';
do $$
begin
  if public.finalize_jobber_schedule_coverage_sync(
    '00000000-0000-0000-0000-000000000638', 1
  ) <> 'watermark_conflict' then
    raise exception 'Jobber coverage CAS did not reject an out-of-order finalizer';
  end if;
end;
$$;
update public.jobber_schedule_sync_watermarks
set generation = 1
where connection_id = 'squeegeeking';
select public.mark_jobber_schedule_coverage_sync_partial(
  '00000000-0000-0000-0000-000000000638', 'watermark_conflict', 2
);
do $$
begin
  if public.reconcile_jobber_schedule_coverage_finalization(
    '00000000-0000-0000-0000-000000000638'
  ) <> 'not_completed' then
    raise exception 'Failed finalization incorrectly reconciled complete';
  end if;
end;
$$;

-- A stable two-pass run uses identical durable leaves and observations.
select public.begin_jobber_schedule_coverage_sync(
  '00000000-0000-0000-0000-000000000538', 'squeegeeking',
  '00000000-0000-0000-0000-000000000138',
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
);

select public.append_jobber_schedule_coverage_leaf(
  '00000000-0000-0000-0000-000000000538', pass_number, 0,
  '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', repeat('a', 64),
  jsonb_build_array(jsonb_build_object(
    'external_visit_id', 'visit-038',
    'external_job_id', 'job-038',
    'external_client_id', 'client-038',
    'external_property_id', 'property-038',
    'jobber_property_web_uri', 'https://secure.getjobber.com/properties/038',
    'job_number', 38,
    'title', 'Disposable visit',
    'client_name', 'Disposable client',
    'visit_status', 'OPAQUE',
    'job_status', 'OPAQUE',
    'is_complete', false,
    'scheduled_start', '2026-07-16T19:00:00Z',
    'scheduled_end', null,
    'completed_at', null,
    'raw_payload', jsonb_build_object('id', 'visit-038'),
    'source_payload_hash', repeat('a', 64),
    'source_observed_at', '2026-07-16T18:00:00Z'
  ))
)
from (values (1::smallint), (2::smallint)) passes(pass_number);

select public.complete_jobber_schedule_coverage_pass(
  '00000000-0000-0000-0000-000000000538', pass_number,
  repeat('a', 64), repeat('b', 64), 1, 1, 1
)
from (values (1::smallint), (2::smallint)) passes(pass_number);

insert into public.jobber_visit_projections (
  connection_id, provider, external_visit_id, external_job_id,
  external_client_id, external_property_id, job_number, title, client_name,
  visit_status, job_status, is_complete, scheduled_start, raw_payload,
  source_payload_hash, source_observed_at, last_seen_at
) values (
  'squeegeeking', 'jobber', 'visit-038', 'newer-job', 'newer-client',
  'newer-property', 39, 'Newer source', 'Newer client', 'NEWER_OPAQUE',
  'NEWER_OPAQUE', false, '2026-07-16T20:00:00Z',
  '{"id":"visit-038","source":"newer"}'::jsonb, repeat('f', 64),
  '2026-07-17T18:00:00Z', '2026-07-17T18:00:00Z'
);

do $$
declare
  result text;
begin
  result := public.finalize_jobber_schedule_coverage_sync(
    '00000000-0000-0000-0000-000000000538', 1
  );
  if result <> 'completed' then
    raise exception 'Stable finalize did not advance watermark atomically';
  end if;
  if (select generation from public.jobber_schedule_sync_watermarks
      where connection_id = 'squeegeeking') <> 2 then
    raise exception 'Stable finalize did not advance watermark atomically';
  end if;
  if (select source_payload_hash from public.jobber_visit_projections
      where connection_id = 'squeegeeking' and external_visit_id = 'visit-038')
      <> repeat('f', 64) then
    raise exception 'Stale Jobber observation overwrote newer projection truth';
  end if;
  if public.finalize_jobber_schedule_coverage_sync(
    '00000000-0000-0000-0000-000000000538', 1
  ) <> 'replay' then
    raise exception 'Stable finalize replay was not idempotent';
  end if;
  if public.reconcile_jobber_schedule_coverage_finalization(
    '00000000-0000-0000-0000-000000000538'
  ) <> 'completed' then
    raise exception 'Committed finalization was not durably reconcilable';
  end if;
end;
$$;

rollback;
