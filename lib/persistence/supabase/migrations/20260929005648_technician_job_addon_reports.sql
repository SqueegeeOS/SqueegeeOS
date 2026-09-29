-- Technician-reported paid add-ons, linked to an exact HomeAtlas assignment.
-- A report is not an invoice, collected revenue, customer consent evidence,
-- or an automatically payable commission. HQ reconciles it separately.
begin;

create table if not exists public.homeatlas_technician_job_addon_reports (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  assignment_id uuid not null references public.homeatlas_technician_visit_assignments(id) on delete restrict,
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  technician_display_name text not null,
  service_name text not null,
  reported_amount_cents integer not null check (reported_amount_cents between 1 and 1000000),
  reported_by_access_grant_id uuid not null references public.technician_access_grants(id) on delete restrict,
  reported_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  check (char_length(trim(technician_display_name)) between 2 and 80),
  check (char_length(trim(service_name)) between 2 and 120),
  check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null
      and char_length(trim(voided_by)) between 2 and 80
      and char_length(trim(void_reason)) between 3 and 500)
  )
);

create index if not exists homeatlas_technician_job_addon_reports_assignment_idx
  on public.homeatlas_technician_job_addon_reports(assignment_id, reported_at desc);
create index if not exists homeatlas_technician_job_addon_reports_technician_idx
  on public.homeatlas_technician_job_addon_reports(technician_id, reported_at desc);

create or replace function public.validate_technician_job_addon_report()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
declare
  assignment_technician_id uuid;
  valid_grant boolean;
begin
  select technician_id into assignment_technician_id
    from public.homeatlas_technician_visit_assignments
    where id = new.assignment_id
    for share;
  if assignment_technician_id is distinct from new.technician_id then
    raise exception 'Add-on job is not assigned to this technician';
  end if;
  select exists (
    select 1 from public.technician_access_grants
    where id = new.reported_by_access_grant_id
      and jobber_user_id = 'homeatlas:' || new.technician_id::text
      and display_name = new.technician_display_name
      and status = 'active'
      and session_expires_at > now()
  ) into valid_grant;
  if not valid_grant then
    raise exception 'Active technician access is required';
  end if;
  return new;
end;
$$;

drop trigger if exists technician_job_addon_report_assignment_guard
  on public.homeatlas_technician_job_addon_reports;
create trigger technician_job_addon_report_assignment_guard
  before insert on public.homeatlas_technician_job_addon_reports
  for each row execute function public.validate_technician_job_addon_report();

create or replace function public.guard_technician_job_addon_correction()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if old.voided_at is not null
    or new.id is distinct from old.id
    or new.client_request_id is distinct from old.client_request_id
    or new.assignment_id is distinct from old.assignment_id
    or new.technician_id is distinct from old.technician_id
    or new.technician_display_name is distinct from old.technician_display_name
    or new.service_name is distinct from old.service_name
    or new.reported_amount_cents is distinct from old.reported_amount_cents
    or new.reported_by_access_grant_id is distinct from old.reported_by_access_grant_id
    or new.reported_at is distinct from old.reported_at
    or new.voided_at is null
    or new.voided_by is null
    or new.void_reason is null then
    raise exception 'Add-on reports are immutable except for one HQ void correction';
  end if;
  return new;
end;
$$;

drop trigger if exists technician_job_addon_report_correction_guard
  on public.homeatlas_technician_job_addon_reports;
create trigger technician_job_addon_report_correction_guard
  before update on public.homeatlas_technician_job_addon_reports
  for each row execute function public.guard_technician_job_addon_correction();

alter table public.homeatlas_technician_job_addon_reports enable row level security;
revoke all on table public.homeatlas_technician_job_addon_reports
  from public, anon, authenticated;
grant select, insert, update on table public.homeatlas_technician_job_addon_reports
  to service_role;
revoke all on function public.validate_technician_job_addon_report()
  from public, anon, authenticated;
revoke all on function public.guard_technician_job_addon_correction()
  from public, anon, authenticated;
grant execute on function public.validate_technician_job_addon_report()
  to service_role;
grant execute on function public.guard_technician_job_addon_correction()
  to service_role;

comment on table public.homeatlas_technician_job_addon_reports is
  'Private technician-reported add-on log for exact assigned jobs. Not a charge, payment, Jobber invoice, or payroll ledger.';
comment on column public.homeatlas_technician_job_addon_reports.reported_amount_cents is
  'Technician-reported customer price; not verified or collected revenue.';

commit;
