-- Isolated read-only Jobber visit projection.
-- No automatic member/property matching and no scheduling or billing authority.

create table if not exists public.jobber_visit_projections (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  provider text not null default 'jobber' check (provider = 'jobber'),
  external_visit_id text not null,
  external_job_id text not null,
  external_client_id text not null,
  external_property_id text not null,
  job_number integer,
  title text,
  client_name text,
  visit_status text not null,
  job_status text,
  is_complete boolean not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,
  match_state text not null default 'manual_review' check (
    match_state in ('manual_review', 'matched', 'ignored')
  ),
  matched_property_id uuid references public.properties(id) on delete restrict,
  matched_obligation_id uuid references public.obligations(id) on delete restrict,
  raw_payload jsonb not null,
  source_payload_hash text not null,
  source_observed_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_visit_id),
  check (
    (match_state = 'matched' and matched_property_id is not null)
    or
    (match_state <> 'matched' and matched_property_id is null and matched_obligation_id is null)
  )
);

create index if not exists jobber_visit_projections_review_idx
  on public.jobber_visit_projections(match_state, scheduled_start);
create index if not exists jobber_visit_projections_job_idx
  on public.jobber_visit_projections(external_job_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobber_visit_projection_obligation_property_fkey'
  ) then
    alter table public.jobber_visit_projections
      add constraint jobber_visit_projection_obligation_property_fkey
      foreign key (matched_obligation_id, matched_property_id)
      references public.obligations(id, property_id)
      on delete restrict;
  end if;
end;
$$;

create table if not exists public.jobber_visit_projection_events (
  id uuid primary key default gen_random_uuid(),
  projection_id uuid not null references public.jobber_visit_projections(id) on delete restrict,
  event_type text not null check (event_type in ('observed', 'source_changed')),
  previous_payload_hash text,
  source_payload_hash text not null,
  safe_details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists jobber_visit_projection_events_projection_idx
  on public.jobber_visit_projection_events(projection_id, occurred_at);

create or replace function public.audit_jobber_visit_projection_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.jobber_visit_projection_events (
      projection_id,
      event_type,
      source_payload_hash,
      safe_details
    ) values (
      new.id,
      'observed',
      new.source_payload_hash,
      jsonb_build_object(
        'external_visit_id', new.external_visit_id,
        'visit_status', new.visit_status
      )
    );
  elsif old.source_payload_hash is distinct from new.source_payload_hash then
    insert into public.jobber_visit_projection_events (
      projection_id,
      event_type,
      previous_payload_hash,
      source_payload_hash,
      safe_details
    ) values (
      new.id,
      'source_changed',
      old.source_payload_hash,
      new.source_payload_hash,
      jsonb_build_object(
        'external_visit_id', new.external_visit_id,
        'previous_status', old.visit_status,
        'visit_status', new.visit_status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists jobber_visit_projections_audit
  on public.jobber_visit_projections;
create trigger jobber_visit_projections_audit
  after insert or update on public.jobber_visit_projections
  for each row execute function public.audit_jobber_visit_projection_change();

create or replace function public.reject_jobber_visit_projection_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'jobber_visit_projection_events is append-only and immutable';
end;
$$;

drop trigger if exists jobber_visit_projection_events_immutable
  on public.jobber_visit_projection_events;
create trigger jobber_visit_projection_events_immutable
  before update or delete on public.jobber_visit_projection_events
  for each row execute function public.reject_jobber_visit_projection_event_change();

drop trigger if exists jobber_visit_projections_updated_at
  on public.jobber_visit_projections;
create trigger jobber_visit_projections_updated_at
  before update on public.jobber_visit_projections
  for each row execute function public.set_updated_at();

alter table public.jobber_visit_projections enable row level security;
alter table public.jobber_visit_projection_events enable row level security;
-- No anon/authenticated policies. These source projections are HQ/server only.

comment on table public.jobber_visit_projections is
  'Read-only Jobber visit observations; never scheduling, fulfillment, portal, or billing truth until explicitly verified and matched';
