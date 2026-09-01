-- Actual on-site job time is separate from Jobber's scheduled window and from
-- HomeAtlas closeout proof. A verified field actor starts once on arrival and
-- finishes once after pack-up; the immutable start and bounded finish form the
-- operational labor record for the exact Jobber-backed appointment.

begin;

create table if not exists public.technician_job_time_entries (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  appointment_id uuid not null references public.member_appointments(id) on delete cascade,
  external_visit_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by_access_grant_id uuid references public.technician_access_grants(id) on delete restrict,
  started_by_jobber_user_id text,
  started_by_display_name text not null,
  started_by_kind text not null check (started_by_kind in ('technician', 'hq')),
  finish_action_id uuid unique,
  finished_by_access_grant_id uuid references public.technician_access_grants(id) on delete restrict,
  finished_by_jobber_user_id text,
  finished_by_display_name text,
  finished_by_kind text check (finished_by_kind in ('technician', 'hq')),
  created_at timestamptz not null default now(),
  check (nullif(trim(external_visit_id), '') is not null),
  check (length(external_visit_id) <= 255),
  check (nullif(trim(started_by_display_name), '') is not null),
  check (length(started_by_display_name) <= 80),
  check (
    (started_by_kind = 'technician'
      and started_by_access_grant_id is not null
      and nullif(trim(coalesce(started_by_jobber_user_id, '')), '') is not null)
    or
    (started_by_kind = 'hq'
      and started_by_access_grant_id is null
      and started_by_jobber_user_id is null)
  ),
  check (
    (ended_at is null
      and finish_action_id is null
      and finished_by_access_grant_id is null
      and finished_by_jobber_user_id is null
      and finished_by_display_name is null
      and finished_by_kind is null)
    or
    (ended_at is not null
      and ended_at >= started_at
      and finish_action_id is not null
      and nullif(trim(coalesce(finished_by_display_name, '')), '') is not null
      and length(finished_by_display_name) <= 80
      and (
        (finished_by_kind = 'technician'
          and finished_by_access_grant_id is not null
          and nullif(trim(coalesce(finished_by_jobber_user_id, '')), '') is not null)
        or
        (finished_by_kind = 'hq'
          and finished_by_access_grant_id is null
          and finished_by_jobber_user_id is null)
      ))
  )
);

create unique index if not exists technician_job_time_entries_appointment_uidx
  on public.technician_job_time_entries(appointment_id);
create index if not exists technician_job_time_entries_started_by_timeline_idx
  on public.technician_job_time_entries(started_by_jobber_user_id, started_at desc)
  where started_by_jobber_user_id is not null;

alter table public.technician_job_time_entries enable row level security;

revoke all privileges on table public.technician_job_time_entries
  from public, anon, authenticated, service_role;
grant select on table public.technician_job_time_entries to service_role;

create or replace function public.record_technician_job_clock_action(
  p_action_id uuid,
  p_property_id uuid,
  p_appointment_id uuid,
  p_grant_id uuid,
  p_jobber_user_id text,
  p_actor_display_name text,
  p_actor_kind text,
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
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_user_id text := nullif(trim(coalesce(p_jobber_user_id, '')), '');
  normalized_actor text := trim(coalesce(p_actor_display_name, ''));
  appointment_property_id uuid;
  appointment_provider text;
  appointment_external_id text;
  entry_row public.technician_job_time_entries%rowtype;
  was_replayed boolean := false;
begin
  if p_action_id is null
     or p_property_id is null
     or p_appointment_id is null
     or normalized_actor = ''
     or length(normalized_actor) > 80
     or p_actor_kind is null
     or p_actor_kind not in ('technician', 'hq')
     or p_action is null
     or p_action not in ('start', 'finish') then
    raise exception 'Invalid technician job clock action';
  end if;

  select appointment.property_id, appointment.provider, appointment.external_id
    into appointment_property_id, appointment_provider, appointment_external_id
  from public.member_appointments appointment
  where appointment.id = p_appointment_id;

  if appointment_property_id is null
     or appointment_property_id <> p_property_id
     or appointment_provider is distinct from 'jobber'
     or nullif(trim(coalesce(appointment_external_id, '')), '') is null then
    raise exception 'Appointment is not a verified Jobber stop for this property';
  end if;

  if p_actor_kind = 'technician' then
    if p_grant_id is null or normalized_user_id is null then
      raise exception 'Technician Field Pass identity is required';
    end if;
    if not exists (
      select 1
      from public.technician_access_grants grant_row
      where grant_row.id = p_grant_id
        and grant_row.status = 'active'
        and grant_row.session_expires_at > now()
        and grant_row.jobber_user_id = normalized_user_id
        and grant_row.display_name = normalized_actor
    ) then
      raise exception 'Technician Field Pass is no longer active';
    end if;
  elsif p_grant_id is not null or normalized_user_id is not null then
    raise exception 'HQ job clock actions cannot impersonate a technician';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_appointment_id::text, 0));

  select entry.*
    into entry_row
  from public.technician_job_time_entries entry
  where entry.appointment_id = p_appointment_id
  for update;

  if p_action = 'start' then
    if entry_row.id is not null then
      was_replayed := true;
    else
      insert into public.technician_job_time_entries (
        id,
        property_id,
        appointment_id,
        external_visit_id,
        started_by_access_grant_id,
        started_by_jobber_user_id,
        started_by_display_name,
        started_by_kind
      ) values (
        p_action_id,
        p_property_id,
        p_appointment_id,
        appointment_external_id,
        p_grant_id,
        normalized_user_id,
        normalized_actor,
        p_actor_kind
      )
      returning * into entry_row;
    end if;
  else
    if entry_row.id is null then
      raise exception 'Start the job clock before finishing it';
    end if;
    if entry_row.ended_at is not null then
      was_replayed := true;
    else
      update public.technician_job_time_entries entry
      set ended_at = now(),
        finish_action_id = p_action_id,
        finished_by_access_grant_id = p_grant_id,
        finished_by_jobber_user_id = normalized_user_id,
        finished_by_display_name = normalized_actor,
        finished_by_kind = p_actor_kind
      where entry.id = entry_row.id
      returning * into entry_row;
    end if;
  end if;

  return query select
    entry_row.id,
    entry_row.started_at,
    entry_row.ended_at,
    case
      when entry_row.ended_at is null then null
      else floor(extract(epoch from (entry_row.ended_at - entry_row.started_at)))::bigint
    end,
    entry_row.started_by_display_name,
    entry_row.finished_by_display_name,
    was_replayed;
end;
$$;

revoke all on function public.record_technician_job_clock_action(
  uuid, uuid, uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_technician_job_clock_action(
  uuid, uuid, uuid, uuid, text, text, text, text
) to service_role;

comment on table public.technician_job_time_entries is
  'Private one-start, one-finish actual on-site time ledger for verified Jobber appointments. Scheduled Jobber duration remains separate.';
comment on function public.record_technician_job_clock_action(
  uuid, uuid, uuid, uuid, text, text, text, text
) is
  'Atomically records an idempotent arrival start or post-pack-up finish for an authorized field actor.';

commit;
