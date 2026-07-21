-- Rollback-only rehearsal for migration 044. Run only in an empty disposable
-- database after migrations through 044 have been applied.
\set ON_ERROR_STOP on

begin;

do $$
begin
  if exists (select 1 from public.jobber_connections) then
    raise exception 'Migration 044 rehearsal requires no Jobber connection';
  end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '44000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'oauth-044-actor-1@example.invalid', '',
    pg_catalog.now(), '{}'::jsonb, '{}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  ),
  (
    '44000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'oauth-044-actor-2@example.invalid', '',
    pg_catalog.now(), '{}'::jsonb, '{}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  );

insert into public.hq_admin_users (user_id, email, role, active) values
  (
    '44000000-0000-4000-8000-000000000001',
    'oauth-044-actor-1@example.invalid',
    'operator',
    true
  ),
  (
    '44000000-0000-4000-8000-000000000002',
    'oauth-044-actor-2@example.invalid',
    'owner',
    true
  );

create function pg_temp.expect_jobber_save_failure(
  test_label text,
  expected_message text,
  requested_operation_id uuid,
  requested_expected_account_id text,
  requested_account_id text,
  requested_account_name text,
  requested_access_token_ciphertext text,
  requested_refresh_token_ciphertext text,
  requested_access_token_expires_at timestamptz,
  requested_graphql_version text,
  requested_actor_id uuid
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  perform public.save_jobber_connection_with_event(
    requested_operation_id,
    requested_expected_account_id,
    requested_account_id,
    requested_account_name,
    requested_access_token_ciphertext,
    requested_refresh_token_ciphertext,
    requested_access_token_expires_at,
    requested_graphql_version,
    requested_actor_id
  );
  raise exception '% unexpectedly succeeded', test_label;
exception
  when others then
    if position(expected_message in sqlerrm) = 0 then
      raise exception '% failed with unexpected message: %', test_label, sqlerrm;
    end if;
end;
$$;

-- Wrong-account authority fails before connection or immutable event state.
select pg_temp.expect_jobber_save_failure(
  'wrong account',
  'did not match configured authority',
  '44000000-0000-4000-8000-000000000010',
  'expected-account',
  'wrong-account',
  'Wrong account',
  'wrong-access-ciphertext',
  'wrong-refresh-ciphertext',
  '2035-01-01T00:00:00Z',
  'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);

do $$
begin
  if exists (select 1 from public.jobber_connections)
    or exists (
      select 1
      from public.jobber_connection_events
      where oauth_operation_id = '44000000-0000-4000-8000-000000000010'
    )
  then
    raise exception 'Wrong-account attempt persisted Jobber state or evidence';
  end if;
end;
$$;

do $$
declare
  outcome text;
begin
  outcome := public.save_jobber_connection_with_event(
    '44000000-0000-4000-8000-000000000011',
    'expected-account',
    'expected-account',
    'SqueegeeKing',
    'access-ciphertext-1',
    'refresh-ciphertext-1',
    '2035-01-01T00:00:00Z',
    'rehearsal-version',
    '44000000-0000-4000-8000-000000000001'
  );
  if outcome <> 'connected' then
    raise exception 'First connection returned %', outcome;
  end if;
end;
$$;

-- Equivalent timestamp spelling normalizes to the exact committed replay.
do $$
declare
  outcome text;
begin
  outcome := public.save_jobber_connection_with_event(
    '44000000-0000-4000-8000-000000000011',
    'expected-account',
    'expected-account',
    'SqueegeeKing',
    'access-ciphertext-1',
    'refresh-ciphertext-1',
    '2035-01-01T01:00:00+01:00',
    'rehearsal-version',
    '44000000-0000-4000-8000-000000000001'
  );
  if outcome <> 'replay' then
    raise exception 'Exact active-actor replay returned %', outcome;
  end if;
end;
$$;

update public.hq_admin_users
set active = false
where user_id = '44000000-0000-4000-8000-000000000001';

do $$
declare
  outcome text;
begin
  outcome := public.save_jobber_connection_with_event(
    '44000000-0000-4000-8000-000000000011',
    'expected-account',
    'expected-account',
    'SqueegeeKing',
    'access-ciphertext-1',
    'refresh-ciphertext-1',
    '2035-01-01T00:00:00Z',
    'rehearsal-version',
    '44000000-0000-4000-8000-000000000001'
  );
  if outcome <> 'replay' then
    raise exception 'Inactive-actor exact replay returned %', outcome;
  end if;
end;
$$;

delete from public.hq_admin_users
where user_id = '44000000-0000-4000-8000-000000000001';

do $$
declare
  outcome text;
begin
  outcome := public.save_jobber_connection_with_event(
    '44000000-0000-4000-8000-000000000011',
    'expected-account',
    'expected-account',
    'SqueegeeKing',
    'access-ciphertext-1',
    'refresh-ciphertext-1',
    '2035-01-01T00:00:00Z',
    'rehearsal-version',
    '44000000-0000-4000-8000-000000000001'
  );
  if outcome <> 'replay' then
    raise exception 'Deleted-actor exact replay returned %', outcome;
  end if;
end;
$$;

-- Every replay-significant field is rejected when changed under the same
-- operation ID. Expected/account ID changes hit the stricter authority guard;
-- all other changes hit the DB-computed canonical digest conflict.
select pg_temp.expect_jobber_save_failure(
  'changed expected account ID', 'did not match configured authority',
  '44000000-0000-4000-8000-000000000011', 'other-account',
  'expected-account', 'SqueegeeKing', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed account ID', 'did not match configured authority',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'other-account', 'SqueegeeKing', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed account name', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'Changed name', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed access ciphertext', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'SqueegeeKing', 'changed-access-ciphertext',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed refresh ciphertext', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'SqueegeeKing', 'access-ciphertext-1',
  'changed-refresh-ciphertext', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed normalized expiry', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'SqueegeeKing', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:01Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed GraphQL version', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'SqueegeeKing', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'changed-version',
  '44000000-0000-4000-8000-000000000001'
);
select pg_temp.expect_jobber_save_failure(
  'changed actor ID', 'replay payload conflict',
  '44000000-0000-4000-8000-000000000011', 'expected-account',
  'expected-account', 'SqueegeeKing', 'access-ciphertext-1',
  'refresh-ciphertext-1', '2035-01-01T00:00:00Z', 'rehearsal-version',
  '44000000-0000-4000-8000-000000000002'
);

do $$
declare
  expected_digest bytea;
  event_details jsonb;
  outcome text;
begin
  select extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        'jobber_oauth_connection_v1',
        '44000000-0000-4000-8000-000000000011',
        'expected-account',
        'expected-account',
        'SqueegeeKing',
        'access-ciphertext-1',
        'refresh-ciphertext-1',
        '2035-01-01T00:00:00.000000Z',
        'rehearsal-version',
        '44000000-0000-4000-8000-000000000001'
      )::text,
      'UTF8'
    ),
    'sha256'
  ) into expected_digest;

  select event.safe_details
  into event_details
  from public.jobber_connection_events event
  where event.oauth_operation_id = '44000000-0000-4000-8000-000000000011';

  if event_details <> pg_catalog.jsonb_build_object(
    'payload_sha256', pg_catalog.encode(expected_digest, 'hex')
  ) then
    raise exception 'Immutable replay evidence is not the DB canonical digest only';
  end if;

  outcome := public.save_jobber_connection_with_event(
    '44000000-0000-4000-8000-000000000012',
    'expected-account',
    'expected-account',
    'SqueegeeKing',
    'access-ciphertext-2',
    'refresh-ciphertext-2',
    '2036-01-01T00:00:00Z',
    'rehearsal-version',
    '44000000-0000-4000-8000-000000000002'
  );
  if outcome <> 'reauthorized' then
    raise exception 'Reauthorization returned %', outcome;
  end if;
end;
$$;

do $$
declare
  connection_generation bigint;
  oauth_event_count integer;
begin
  select token_generation
  into connection_generation
  from public.jobber_connections
  where id = 'squeegeeking';

  select pg_catalog.count(*)::integer
  into oauth_event_count
  from public.jobber_connection_events
  where oauth_operation_id is not null;

  if connection_generation <> 2 or oauth_event_count <> 2 then
    raise exception 'Expected one connection, one reauthorization, and no replay mutation';
  end if;
end;
$$;

rollback;
