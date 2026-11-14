-- Optional account-specific timing; never changes contact consent or rule activation.
create table if not exists public.customer_visit_reminder_preferences (
  homeowner_id uuid primary key references public.homeowners(id) on delete cascade,
  offset_minutes integer[] not null default '{1440}',
  updated_at timestamptz not null default now(),
  constraint reminder_offset_count check (cardinality(offset_minutes) <= 4),
  constraint reminder_offset_bounds check (60 <= all(offset_minutes) and 43200 >= all(offset_minutes) and array_position(offset_minutes, null) is null)
);

alter table public.customer_visit_reminder_preferences enable row level security;
revoke all on public.customer_visit_reminder_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.customer_visit_reminder_preferences to service_role;
