-- Run only against an isolated disposable database after migration 035.
-- Exercises success, failure, event-write rollback, and stale-lease behavior.
-- The outer transaction retains nothing.
\set ON_ERROR_STOP on

begin;

do $$
begin
  if exists (
    select 1 from public.jobber_connections where id = 'squeegeeking'
  ) then
    raise exception 'Rehearsal requires no existing Jobber connection';
  end if;

  perform public.save_jobber_connection_with_event(
    'rehearsal-account',
    'Rehearsal account',
    'initial-access-ciphertext',
    'initial-refresh-ciphertext',
    pg_catalog.now() + interval '1 hour',
    'rehearsal-version',
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  if not public.acquire_jobber_refresh_lease_for_generation(
    '00000000-0000-0000-0000-000000000011'::uuid,
    1,
    30
  ) then
    raise exception 'Could not acquire the first rehearsal lease';
  end if;
end;
$$;

create function pg_temp.reject_jobber_refresh_event()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'injected Jobber refresh event failure';
end;
$$;

create trigger inject_jobber_refresh_event_failure
  before insert on public.jobber_connection_events
  for each row execute function pg_temp.reject_jobber_refresh_event();

do $$
declare
  event_count_before bigint;
  observed_failure boolean := false;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;

  begin
    perform public.complete_jobber_refresh_with_event(
      '00000000-0000-0000-0000-000000000011'::uuid,
      1,
      'rotated-access-ciphertext',
      'rotated-refresh-ciphertext',
      pg_catalog.now() + interval '1 hour'
    );
  exception
    when others then
      if sqlerrm <> 'injected Jobber refresh event failure' then
        raise;
      end if;
      observed_failure := true;
  end;

  if not observed_failure then
    raise exception 'Expected injected refreshed-event failure';
  end if;
  if not exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
      and token_generation = 1
      and access_token_ciphertext = 'initial-access-ciphertext'
      and refresh_lease_id =
        '00000000-0000-0000-0000-000000000011'::uuid
  ) then
    raise exception 'Successful refresh state survived event rollback';
  end if;
  if (select count(*) from public.jobber_connection_events)
    <> event_count_before
  then
    raise exception 'Successful refresh event count changed after rollback';
  end if;
end;
$$;

drop trigger inject_jobber_refresh_event_failure
  on public.jobber_connection_events;

do $$
declare
  event_count_before bigint;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;
  if not public.complete_jobber_refresh_with_event(
    '00000000-0000-0000-0000-000000000011'::uuid,
    1,
    'rotated-access-ciphertext',
    'rotated-refresh-ciphertext',
    pg_catalog.now() + interval '1 hour'
  ) then
    raise exception 'Expected successful refresh transition';
  end if;
  if not exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
      and status = 'connected'
      and token_generation = 2
      and access_token_ciphertext = 'rotated-access-ciphertext'
      and refresh_lease_id is null
  ) then
    raise exception 'Successful refresh state was not persisted';
  end if;
  if (select count(*) from public.jobber_connection_events)
    <> event_count_before + 1
  then
    raise exception 'Successful refresh event was not persisted atomically';
  end if;
end;
$$;

do $$
declare
  event_count_before bigint;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;
  if public.complete_jobber_refresh_with_event(
    '00000000-0000-0000-0000-000000000011'::uuid,
    1,
    'stale-access-ciphertext',
    'stale-refresh-ciphertext',
    pg_catalog.now() + interval '1 hour'
  ) then
    raise exception 'A stale refresh lease unexpectedly succeeded';
  end if;
  if not exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
      and token_generation = 2
      and access_token_ciphertext = 'rotated-access-ciphertext'
  ) then
    raise exception 'Stale lease changed newer connection truth';
  end if;
  if (select count(*) from public.jobber_connection_events)
    <> event_count_before
  then
    raise exception 'Stale lease appended an event';
  end if;

  if not public.acquire_jobber_refresh_lease_for_generation(
    '00000000-0000-0000-0000-000000000012'::uuid,
    2,
    30
  ) then
    raise exception 'Could not acquire the second rehearsal lease';
  end if;
end;
$$;

create trigger inject_jobber_refresh_event_failure
  before insert on public.jobber_connection_events
  for each row execute function pg_temp.reject_jobber_refresh_event();

do $$
declare
  event_count_before bigint;
  observed_failure boolean := false;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;
  begin
    perform public.fail_jobber_refresh_with_event(
      '00000000-0000-0000-0000-000000000012'::uuid,
      2,
      true
    );
  exception
    when others then
      if sqlerrm <> 'injected Jobber refresh event failure' then
        raise;
      end if;
      observed_failure := true;
  end;

  if not observed_failure then
    raise exception 'Expected injected refresh-failure event failure';
  end if;
  if not exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
      and status = 'connected'
      and last_error_code is null
      and refresh_lease_id =
        '00000000-0000-0000-0000-000000000012'::uuid
  ) then
    raise exception 'Failed-refresh state survived event rollback';
  end if;
  if (select count(*) from public.jobber_connection_events)
    <> event_count_before
  then
    raise exception 'Failed-refresh event count changed after rollback';
  end if;
end;
$$;

drop trigger inject_jobber_refresh_event_failure
  on public.jobber_connection_events;

do $$
declare
  event_count_before bigint;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;
  if not public.fail_jobber_refresh_with_event(
    '00000000-0000-0000-0000-000000000012'::uuid,
    2,
    true
  ) then
    raise exception 'Expected failed-refresh transition';
  end if;
  if not exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
      and status = 'refresh_required'
      and last_error_code = 'jobber_reauthorization_required'
      and refresh_lease_id is null
  ) then
    raise exception 'Failed-refresh state was not persisted';
  end if;
  if (select count(*) from public.jobber_connection_events)
    <> event_count_before + 1
  then
    raise exception 'Failed-refresh event was not persisted atomically';
  end if;
end;
$$;

rollback;
