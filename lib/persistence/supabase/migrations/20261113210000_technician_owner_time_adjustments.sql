-- Owner-reported duration is separate from original technician clock evidence.
begin;
create table public.homeatlas_technician_owner_time_adjustments (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  work_date date not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1080),
  resolved_clock_id uuid references public.homeatlas_technician_job_clocks(id) on delete restrict,
  reason text not null check (reason in ('owner_estimate', 'owner_added_time')),
  note text not null check (char_length(note) between 1 and 1000),
  entered_by text not null check (char_length(trim(entered_by)) between 1 and 100),
  entered_at timestamptz not null default now(),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 1 and 200),
  check (resolved_clock_id is null or reason = 'owner_estimate')
);
create index homeatlas_owner_time_technician_date_idx on public.homeatlas_technician_owner_time_adjustments(technician_id, work_date);
create index homeatlas_owner_time_resolved_clock_idx on public.homeatlas_technician_owner_time_adjustments(resolved_clock_id) where resolved_clock_id is not null;
create table public.homeatlas_technician_owner_time_adjustment_voids (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null unique references public.homeatlas_technician_owner_time_adjustments(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  voided_by text not null check (char_length(trim(voided_by)) between 1 and 100),
  voided_at timestamptz not null default now()
);
alter table public.homeatlas_technician_owner_time_adjustments enable row level security;
alter table public.homeatlas_technician_owner_time_adjustment_voids enable row level security;
revoke all privileges on table public.homeatlas_technician_owner_time_adjustments from public, anon, authenticated, service_role;
revoke all privileges on table public.homeatlas_technician_owner_time_adjustment_voids from public, anon, authenticated, service_role;
grant select on table public.homeatlas_technician_owner_time_adjustments to service_role;
grant select on table public.homeatlas_technician_owner_time_adjustment_voids to service_role;

create function public.record_homeatlas_owner_time_adjustment(
  p_technician_id uuid, p_work_date date, p_duration_minutes integer,
  p_resolved_clock_id uuid, p_reason text, p_note text,
  p_entered_by text, p_idempotency_key text
) returns public.homeatlas_technician_owner_time_adjustments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing public.homeatlas_technician_owner_time_adjustments%rowtype;
  clock_row public.homeatlas_technician_job_clocks%rowtype;
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if p_technician_id is null or p_work_date is null or p_duration_minutes is null
    or p_duration_minutes not between 1 and 1080
    or p_reason is null or p_reason not in ('owner_estimate','owner_added_time')
    or nullif(trim(p_note),'') is null or char_length(p_note) > 1000
    or nullif(trim(p_entered_by),'') is null or char_length(p_entered_by) > 100
    or nullif(trim(p_idempotency_key),'') is null or char_length(p_idempotency_key) > 200 then
    raise exception 'Provide valid owner time adjustment details';
  end if;
  -- Lock the request key as well as technician, so a cross-technician key reuse is safe.
  perform pg_advisory_xact_lock(hashtextextended('owner-time-key:' || p_idempotency_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('owner-time-tech:' || p_technician_id::text, 0));
  select * into existing from public.homeatlas_technician_owner_time_adjustments where idempotency_key = p_idempotency_key;
  if found then
    if existing.technician_id is distinct from p_technician_id
      or existing.work_date is distinct from p_work_date
      or existing.duration_minutes is distinct from p_duration_minutes
      or existing.resolved_clock_id is distinct from p_resolved_clock_id
      or existing.reason is distinct from p_reason
      or existing.note is distinct from trim(p_note)
      or existing.entered_by is distinct from trim(p_entered_by) then
      raise exception 'This request key already belongs to different adjustment details';
    end if;
    if exists (select 1 from public.homeatlas_technician_owner_time_adjustment_voids where adjustment_id=existing.id) then
      raise exception 'This adjustment was voided; use a new request key for a replacement';
    end if;
    return existing;
  end if;
  if p_work_date > today or p_work_date < today - 366 then
    raise exception 'Owner time must be dated within the last year and not in the future';
  end if;
  if not exists (select 1 from public.homeatlas_technicians where id=p_technician_id) then
    raise exception 'Technician not found';
  end if;
  if p_resolved_clock_id is not null then
    select * into clock_row from public.homeatlas_technician_job_clocks where id=p_resolved_clock_id for update;
    if not found or clock_row.ended_at is not null then
      raise exception 'Choose an existing unfinished technician clock';
    end if;
    if not exists (select 1 from public.homeatlas_technician_visit_assignments where id=clock_row.assignment_id and technician_id=p_technician_id) then
      raise exception 'Clock belongs to a different technician';
    end if;
    if (clock_row.started_at at time zone 'America/Los_Angeles')::date <> p_work_date then
      raise exception 'Adjustment date must match the clock Pacific work date';
    end if;
    if exists (select 1 from public.homeatlas_technician_owner_time_adjustments a where a.resolved_clock_id=p_resolved_clock_id
      and not exists (select 1 from public.homeatlas_technician_owner_time_adjustment_voids v where v.adjustment_id=a.id)) then
      raise exception 'This clock already has an active owner resolution';
    end if;
  end if;
  insert into public.homeatlas_technician_owner_time_adjustments
    (technician_id,work_date,duration_minutes,resolved_clock_id,reason,note,entered_by,idempotency_key)
  values (p_technician_id,p_work_date,p_duration_minutes,p_resolved_clock_id,p_reason,trim(p_note),trim(p_entered_by),p_idempotency_key)
  returning * into existing;
  return existing;
end;
$$;
revoke all on function public.record_homeatlas_owner_time_adjustment(uuid,date,integer,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_homeatlas_owner_time_adjustment(uuid,date,integer,uuid,text,text,text,text) to service_role;

create function public.void_homeatlas_owner_time_adjustment(p_adjustment_id uuid,p_reason text,p_voided_by text)
returns public.homeatlas_technician_owner_time_adjustment_voids
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  adjustment public.homeatlas_technician_owner_time_adjustments%rowtype;
  result public.homeatlas_technician_owner_time_adjustment_voids%rowtype;
begin
  if nullif(trim(p_reason),'') is null or char_length(p_reason)>1000 or nullif(trim(p_voided_by),'') is null or char_length(p_voided_by)>100 then
    raise exception 'Provide a reason and owner identity for reversal';
  end if;
  select * into adjustment from public.homeatlas_technician_owner_time_adjustments where id=p_adjustment_id;
  if not found then raise exception 'Adjustment not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('owner-time-tech:' || adjustment.technician_id::text, 0));
  select * into result from public.homeatlas_technician_owner_time_adjustment_voids where adjustment_id=p_adjustment_id;
  if found then return result; end if;
  insert into public.homeatlas_technician_owner_time_adjustment_voids(adjustment_id,reason,voided_by)
  values(p_adjustment_id,trim(p_reason),trim(p_voided_by)) returning * into result;
  return result;
end;
$$;
revoke all on function public.void_homeatlas_owner_time_adjustment(uuid,text,text) from public, anon, authenticated;
grant execute on function public.void_homeatlas_owner_time_adjustment(uuid,text,text) to service_role;
comment on table public.homeatlas_technician_owner_time_adjustments is 'Append-only owner-reported duration, separate from verified clock evidence. Active linked adjustments administratively resolve unfinished clocks; never count both sources.';
-- A later technician finish must not create a second time source for a resolved clock.
create function public.guard_homeatlas_owner_resolved_clock()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.ended_at is not null and old.ended_at is null and exists (
    select 1 from public.homeatlas_technician_owner_time_adjustments a
    where a.resolved_clock_id=old.id and not exists (
      select 1 from public.homeatlas_technician_owner_time_adjustment_voids v where v.adjustment_id=a.id
    )
  ) then
    raise exception 'Void the owner resolution before recording a technician clock-out';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_homeatlas_owner_resolved_clock() from public, anon, authenticated;
create trigger homeatlas_owner_resolved_clock_guard before update of ended_at
on public.homeatlas_technician_job_clocks for each row execute function public.guard_homeatlas_owner_resolved_clock();

create function public.guard_homeatlas_owner_time_immutable()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  raise exception 'Owner time audit records are immutable; use a separate reversal';
end;
$$;
revoke all on function public.guard_homeatlas_owner_time_immutable() from public, anon, authenticated;
create trigger homeatlas_owner_time_immutable before update or delete
on public.homeatlas_technician_owner_time_adjustments for each row execute function public.guard_homeatlas_owner_time_immutable();
create trigger homeatlas_owner_time_void_immutable before update or delete
on public.homeatlas_technician_owner_time_adjustment_voids for each row execute function public.guard_homeatlas_owner_time_immutable();
commit;
