-- Append-only proof for owner-directed Jobber technician assignments.

begin;

create table if not exists public.owner_dispatch_assignment_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  projection_id uuid not null references public.jobber_visit_projections(id) on delete restrict,
  external_visit_id text not null,
  previous_assigned_user_ids text[] not null default '{}',
  assigned_user_ids text[] not null,
  assigned_user_names text[] not null,
  actor text not null check (nullif(trim(actor), '') is not null and char_length(actor) <= 100),
  provider_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (cardinality(assigned_user_ids) between 1 and 25),
  check (cardinality(assigned_user_ids) = cardinality(assigned_user_names))
);

create index if not exists owner_dispatch_assignment_events_visit_idx
  on public.owner_dispatch_assignment_events(external_visit_id, created_at desc);

create or replace function public.reject_owner_dispatch_assignment_event_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  raise exception 'owner_dispatch_assignment_events is append-only and immutable';
end;
$$;

drop trigger if exists owner_dispatch_assignment_events_immutable
  on public.owner_dispatch_assignment_events;
create trigger owner_dispatch_assignment_events_immutable
  before update or delete on public.owner_dispatch_assignment_events
  for each row execute function public.reject_owner_dispatch_assignment_event_change();

alter table public.owner_dispatch_assignment_events enable row level security;

revoke all on table public.owner_dispatch_assignment_events from public, anon, authenticated;
revoke all on table public.owner_dispatch_assignment_events from service_role;
grant select, insert on table public.owner_dispatch_assignment_events to service_role;
revoke execute on function public.reject_owner_dispatch_assignment_event_change() from public, anon, authenticated, service_role;

comment on table public.owner_dispatch_assignment_events is
  'Append-only owner audit of technician assignments confirmed by Jobber; service-role only';

commit;
