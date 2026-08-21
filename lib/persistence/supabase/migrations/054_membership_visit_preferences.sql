-- Per-visit service plan and preferred scheduling month for each membership.
-- A preferred month is planning guidance only; Jobber remains the booked-date authority.

create table if not exists public.membership_visit_preferences (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  visit_sequence smallint not null check (visit_sequence between 1 and 12),
  preferred_month smallint check (preferred_month between 1 and 12),
  timing_note text,
  service_summary text,
  visit_price numeric(10, 2) check (visit_price is null or visit_price >= 0),
  customer_editable_month boolean not null default true,
  updated_by text not null default 'hq',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, visit_sequence)
);

create index if not exists membership_visit_preferences_membership_idx
  on public.membership_visit_preferences(membership_id, visit_sequence);

drop trigger if exists membership_visit_preferences_updated_at
  on public.membership_visit_preferences;
create trigger membership_visit_preferences_updated_at
  before update on public.membership_visit_preferences
  for each row execute function public.set_updated_at();

comment on table public.membership_visit_preferences is
  'Per-visit membership service scope and customer scheduling-month preference; not a booked appointment.';
comment on column public.membership_visit_preferences.preferred_month is
  'Calendar month 1-12 preferred by the customer; Jobber remains the scheduling source of truth.';

alter table public.membership_visit_preferences enable row level security;

revoke all privileges on table public.membership_visit_preferences
  from public, anon, authenticated;
grant select, insert, update, delete on table public.membership_visit_preferences
  to service_role;
