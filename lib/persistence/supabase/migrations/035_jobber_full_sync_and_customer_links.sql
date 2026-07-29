-- Full read-only Jobber synchronization plus supervised customer identity links.
-- Jobber remains scheduling truth. Customer links identify the same household;
-- they do not create memberships, fulfill obligations, or enable billing.

create extension if not exists pg_trgm;

alter table public.jobber_visit_projections
  add column if not exists search_text text not null default '';

update public.jobber_visit_projections
set search_text = lower(concat_ws(
  ' ',
  client_name,
  title,
  visit_status,
  job_status,
  job_number::text
))
where search_text = '';

create index if not exists jobber_visit_projections_search_idx
  on public.jobber_visit_projections using gin (search_text gin_trgm_ops);

create table if not exists public.jobber_client_projections (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  provider text not null default 'jobber' check (provider = 'jobber'),
  external_client_id text not null,
  name text not null,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  jobber_web_uri text not null,
  is_archived boolean not null default false,
  properties jsonb not null default '[]'::jsonb,
  property_count integer not null default 0 check (property_count >= 0),
  properties_complete boolean not null default true,
  search_text text not null,
  raw_payload jsonb not null,
  source_payload_hash text not null,
  source_observed_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_client_id),
  check (nullif(trim(external_client_id), '') is not null),
  check (nullif(trim(name), '') is not null),
  check (jobber_web_uri ~ '^https://')
);

create index if not exists jobber_client_projections_search_idx
  on public.jobber_client_projections using gin (search_text gin_trgm_ops);
create index if not exists jobber_client_projections_name_idx
  on public.jobber_client_projections(connection_id, name);

drop trigger if exists jobber_client_projections_updated_at
  on public.jobber_client_projections;
create trigger jobber_client_projections_updated_at
  before update on public.jobber_client_projections
  for each row execute function public.set_updated_at();

create table if not exists public.jobber_customer_links (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null,
  external_client_id text not null,
  homeowner_id uuid not null references public.homeowners(id) on delete restrict,
  link_state text not null default 'active' check (
    link_state in ('active', 'revoked')
  ),
  linked_by text not null,
  link_reason text not null,
  linked_at timestamptz not null default now(),
  revoked_by text,
  revoke_reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_client_id),
  foreign key (connection_id, external_client_id)
    references public.jobber_client_projections(connection_id, external_client_id)
    on delete restrict,
  check (nullif(trim(linked_by), '') is not null),
  check (nullif(trim(link_reason), '') is not null),
  check (
    (link_state = 'active'
      and revoked_by is null
      and revoke_reason is null
      and revoked_at is null)
    or
    (link_state = 'revoked'
      and nullif(trim(coalesce(revoked_by, '')), '') is not null
      and nullif(trim(coalesce(revoke_reason, '')), '') is not null
      and revoked_at is not null)
  )
);

create unique index if not exists jobber_customer_links_active_homeowner_unique
  on public.jobber_customer_links(connection_id, homeowner_id)
  where link_state = 'active';
create index if not exists jobber_customer_links_homeowner_idx
  on public.jobber_customer_links(homeowner_id, link_state);

create or replace function public.validate_jobber_customer_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.connection_id is distinct from old.connection_id
      or new.external_client_id is distinct from old.external_client_id
    then
      raise exception 'Jobber customer identity cannot be changed';
    end if;

    if old.link_state = 'active'
      and new.link_state = 'active'
      and new.homeowner_id is distinct from old.homeowner_id
    then
      raise exception 'Revoke the active Jobber customer link before relinking';
    end if;

    if new.homeowner_id is distinct from old.homeowner_id
      and not (old.link_state = 'revoked' and new.link_state = 'active')
    then
      raise exception 'HomeAtlas customer identity may change only during an audited relink';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobber_customer_links_validate
  on public.jobber_customer_links;
create trigger jobber_customer_links_validate
  before insert or update on public.jobber_customer_links
  for each row execute function public.validate_jobber_customer_link();

drop trigger if exists jobber_customer_links_updated_at
  on public.jobber_customer_links;
create trigger jobber_customer_links_updated_at
  before update on public.jobber_customer_links
  for each row execute function public.set_updated_at();

create table if not exists public.jobber_customer_link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.jobber_customer_links(id) on delete restrict,
  event_type text not null check (
    event_type in ('linked', 'relinked', 'revoked')
  ),
  external_client_id text not null,
  previous_homeowner_id uuid,
  homeowner_id uuid not null,
  actor text not null,
  reason text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists jobber_customer_link_events_link_idx
  on public.jobber_customer_link_events(link_id, occurred_at);

create or replace function public.audit_jobber_customer_link_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_event_type text;
  event_actor text;
  event_reason text;
begin
  if tg_op = 'INSERT' then
    next_event_type := 'linked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  elsif old.link_state = 'active' and new.link_state = 'revoked' then
    next_event_type := 'revoked';
    event_actor := new.revoked_by;
    event_reason := new.revoke_reason;
  elsif old.link_state = 'revoked' and new.link_state = 'active' then
    next_event_type := 'relinked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  else
    return new;
  end if;

  insert into public.jobber_customer_link_events (
    link_id,
    event_type,
    external_client_id,
    previous_homeowner_id,
    homeowner_id,
    actor,
    reason
  ) values (
    new.id,
    next_event_type,
    new.external_client_id,
    case when tg_op = 'UPDATE' then old.homeowner_id else null end,
    new.homeowner_id,
    event_actor,
    event_reason
  );

  return new;
end;
$$;

drop trigger if exists jobber_customer_links_audit
  on public.jobber_customer_links;
create trigger jobber_customer_links_audit
  after insert or update on public.jobber_customer_links
  for each row execute function public.audit_jobber_customer_link_change();

create or replace function public.reject_jobber_customer_link_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Jobber customer link history is immutable and links must be revoked';
end;
$$;

drop trigger if exists jobber_customer_link_events_immutable
  on public.jobber_customer_link_events;
create trigger jobber_customer_link_events_immutable
  before update or delete on public.jobber_customer_link_events
  for each row execute function public.reject_jobber_customer_link_change();

drop trigger if exists jobber_customer_links_no_delete
  on public.jobber_customer_links;
create trigger jobber_customer_links_no_delete
  before delete on public.jobber_customer_links
  for each row execute function public.reject_jobber_customer_link_change();

alter table public.jobber_client_projections enable row level security;
alter table public.jobber_customer_links enable row level security;
alter table public.jobber_customer_link_events enable row level security;
-- No anon/authenticated policies. Jobber identity data is HQ/server only.

comment on table public.jobber_client_projections is
  'Read-only searchable projection of every Jobber client visible to the connected account';
comment on table public.jobber_customer_links is
  'Explicit supervised Jobber-client to HomeAtlas-homeowner identity links; never scheduling or billing authority';
