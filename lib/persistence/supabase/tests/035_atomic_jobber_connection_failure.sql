-- Run only against an isolated disposable database after migration 035.
-- This injects an immutable-event write failure and proves the connection
-- state rolls back in the same transaction. Nothing is retained.
\set ON_ERROR_STOP on

begin;

do $$
begin
  if exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
  ) then
    raise exception 'Rehearsal requires no existing Jobber connection';
  end if;
end;
$$;

create function pg_temp.reject_jobber_connection_event()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'injected Jobber event failure';
end;
$$;

create trigger inject_jobber_connection_event_failure
  before insert on public.jobber_connection_events
  for each row execute function pg_temp.reject_jobber_connection_event();

do $$
declare
  event_count_before bigint;
  event_count_after bigint;
  observed_injected_failure boolean := false;
begin
  select count(*) into event_count_before
  from public.jobber_connection_events;

  begin
    perform public.save_jobber_connection_with_event(
      'rehearsal-account',
      'Rehearsal account',
      'rehearsal-access-ciphertext',
      'rehearsal-refresh-ciphertext',
      pg_catalog.now() + interval '1 hour',
      'rehearsal-version',
      '00000000-0000-0000-0000-000000000001'::uuid
    );
  exception
    when others then
      if sqlerrm <> 'injected Jobber event failure' then
        raise;
      end if;
      observed_injected_failure := true;
  end;

  if not observed_injected_failure then
    raise exception 'Expected the injected event failure';
  end if;

  if exists (
    select 1
    from public.jobber_connections
    where id = 'squeegeeking'
  ) then
    raise exception 'Connection state survived an event-write failure';
  end if;

  select count(*) into event_count_after
  from public.jobber_connection_events;

  if event_count_after <> event_count_before then
    raise exception 'Event count changed despite the injected failure';
  end if;
end;
$$;

rollback;
