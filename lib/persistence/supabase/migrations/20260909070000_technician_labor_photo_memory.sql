-- Audited owner-entered technician time and native-photo publication history.
-- Manual time never rewrites a technician clock. It is a separate evidence source.

begin;

create table if not exists public.homeatlas_technician_manual_time_entries (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  assignment_id uuid references public.homeatlas_technician_visit_assignments(id) on delete restrict,
  work_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  reason text not null check (reason in ('missed_clock', 'pre_atlas', 'owner_correction')),
  note text not null default '',
  entered_by text not null,
  entered_at timestamptz not null default now(),
  check (ended_at > started_at),
  check (ended_at <= started_at + interval '18 hours'),
  check (char_length(note) <= 1000),
  check (nullif(trim(entered_by), '') is not null and char_length(entered_by) <= 100)
);

create table if not exists public.homeatlas_technician_manual_time_voids (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null unique references public.homeatlas_technician_manual_time_entries(id) on delete restrict,
  voided_by text not null,
  reason text not null,
  voided_at timestamptz not null default now(),
  check (nullif(trim(voided_by), '') is not null and char_length(voided_by) <= 100),
  check (nullif(trim(reason), '') is not null and char_length(reason) <= 500)
);

create table if not exists public.homeatlas_technician_photo_publication_events (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.homeatlas_technician_job_photos(id) on delete restrict,
  technician_id uuid not null references public.homeatlas_technicians(id) on delete restrict,
  property_id uuid references public.properties(id) on delete restrict,
  previous_customer_visible boolean not null,
  customer_visible boolean not null,
  actor text not null,
  occurred_at timestamptz not null default now(),
  check (nullif(trim(actor), '') is not null and char_length(actor) <= 100)
);

create index if not exists homeatlas_technician_manual_time_active_idx
  on public.homeatlas_technician_manual_time_entries(technician_id, started_at desc);
create index if not exists homeatlas_technician_manual_time_assignment_idx
  on public.homeatlas_technician_manual_time_entries(assignment_id)
  where assignment_id is not null;
create index if not exists homeatlas_technician_photo_publication_photo_idx
  on public.homeatlas_technician_photo_publication_events(photo_id, occurred_at desc);
create index if not exists homeatlas_technician_photo_publication_property_idx
  on public.homeatlas_technician_photo_publication_events(property_id, occurred_at desc)
  where property_id is not null;

alter table public.homeatlas_technician_manual_time_entries enable row level security;
alter table public.homeatlas_technician_manual_time_voids enable row level security;
alter table public.homeatlas_technician_photo_publication_events enable row level security;

revoke all on table public.homeatlas_technician_manual_time_entries from public, anon, authenticated;
revoke all on table public.homeatlas_technician_manual_time_voids from public, anon, authenticated;
revoke all on table public.homeatlas_technician_photo_publication_events from public, anon, authenticated;
grant select, insert on table public.homeatlas_technician_manual_time_entries to service_role;
grant select, insert on table public.homeatlas_technician_manual_time_voids to service_role;
grant select, insert on table public.homeatlas_technician_photo_publication_events to service_role;

commit;
