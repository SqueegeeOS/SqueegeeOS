-- Supervised Jobber property classification.
-- Absence of an active link means Jobber-only. A link identifies a verified
-- member property; it does not classify a visit as HomeAtlas Care, fulfill an
-- obligation, create Property Memory, or enable billing.

alter table public.jobber_visit_projections
  add column if not exists jobber_property_web_uri text;

alter table public.jobber_visit_projections
  drop constraint if exists jobber_visit_projections_property_web_uri_check,
  add constraint jobber_visit_projections_property_web_uri_check check (
    jobber_property_web_uri is null
    or jobber_property_web_uri ~ '^https://'
  );

create table if not exists public.jobber_property_links (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  external_property_id text not null,
  property_id uuid not null references public.properties(id) on delete restrict,
  membership_id uuid not null references public.memberships(id) on delete restrict,
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
  unique (connection_id, external_property_id),
  check (nullif(trim(external_property_id), '') is not null),
  check (nullif(trim(linked_by), '') is not null),
  check (nullif(trim(link_reason), '') is not null),
  check (
    (link_state = 'active'
      and revoked_by is null
      and revoke_reason is null
      and revoked_at is null)
    or
    (link_state = 'revoked'
      and revoked_by is not null
      and nullif(trim(revoked_by), '') is not null
      and revoke_reason is not null
      and nullif(trim(revoke_reason), '') is not null
      and revoked_at is not null)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobber_property_links_membership_property_fkey'
  ) then
    alter table public.jobber_property_links
      add constraint jobber_property_links_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists jobber_property_links_active_property_unique
  on public.jobber_property_links(connection_id, property_id)
  where link_state = 'active';

create index if not exists jobber_property_links_membership_idx
  on public.jobber_property_links(membership_id, link_state);

create or replace function public.validate_jobber_property_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.connection_id is distinct from old.connection_id
      or new.external_property_id is distinct from old.external_property_id
    then
      raise exception 'Jobber property identity cannot be changed';
    end if;

    if old.link_state = 'active'
      and new.link_state = 'active'
      and (
        new.property_id is distinct from old.property_id
        or new.membership_id is distinct from old.membership_id
      )
    then
      raise exception 'Revoke the active Jobber property link before relinking';
    end if;
  end if;

  if new.link_state = 'active' and not exists (
    select 1
    from public.memberships membership
    join public.properties property
      on property.id = membership.property_id
     and property.homeowner_id = membership.homeowner_id
    where membership.id = new.membership_id
      and membership.property_id = new.property_id
      and membership.status = 'active'
      and membership.payment_setup_completed_at is not null
      and membership.agreement_id is not null
      and nullif(trim(coalesce(membership.sales_tier, '')), '') is not null
      and membership.visit_price is not null
  ) then
    raise exception 'Jobber property links require a strictly active HomeAtlas membership at the same property';
  end if;

  return new;
end;
$$;

drop trigger if exists jobber_property_links_validate
  on public.jobber_property_links;
create trigger jobber_property_links_validate
  before insert or update on public.jobber_property_links
  for each row execute function public.validate_jobber_property_link();

drop trigger if exists jobber_property_links_updated_at
  on public.jobber_property_links;
create trigger jobber_property_links_updated_at
  before update on public.jobber_property_links
  for each row execute function public.set_updated_at();

create table if not exists public.jobber_property_link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.jobber_property_links(id) on delete restrict,
  event_type text not null check (
    event_type in ('linked', 'relinked', 'revoked')
  ),
  external_property_id text not null,
  previous_property_id uuid,
  property_id uuid not null,
  previous_membership_id uuid,
  membership_id uuid not null,
  actor text not null,
  reason text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists jobber_property_link_events_link_idx
  on public.jobber_property_link_events(link_id, occurred_at);

create or replace function public.audit_jobber_property_link_change()
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

  insert into public.jobber_property_link_events (
    link_id,
    event_type,
    external_property_id,
    previous_property_id,
    property_id,
    previous_membership_id,
    membership_id,
    actor,
    reason
  ) values (
    new.id,
    next_event_type,
    new.external_property_id,
    case when tg_op = 'UPDATE' then old.property_id else null end,
    new.property_id,
    case when tg_op = 'UPDATE' then old.membership_id else null end,
    new.membership_id,
    event_actor,
    event_reason
  );

  return new;
end;
$$;

drop trigger if exists jobber_property_links_audit
  on public.jobber_property_links;
create trigger jobber_property_links_audit
  after insert or update on public.jobber_property_links
  for each row execute function public.audit_jobber_property_link_change();

create or replace function public.reject_jobber_property_link_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'jobber_property_link_events is append-only and immutable';
end;
$$;

drop trigger if exists jobber_property_link_events_immutable
  on public.jobber_property_link_events;
create trigger jobber_property_link_events_immutable
  before update or delete on public.jobber_property_link_events
  for each row execute function public.reject_jobber_property_link_event_change();

create or replace function public.reject_jobber_property_link_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Jobber property links must be revoked, never deleted';
end;
$$;

drop trigger if exists jobber_property_links_no_delete
  on public.jobber_property_links;
create trigger jobber_property_links_no_delete
  before delete on public.jobber_property_links
  for each row execute function public.reject_jobber_property_link_delete();

alter table public.jobber_property_links enable row level security;
alter table public.jobber_property_link_events enable row level security;
-- No anon/authenticated policies. Property classification is HQ/server only.

comment on table public.jobber_property_links is
  'Explicit supervised Jobber-property to HomeAtlas-member-property links. No row means Jobber-only; a row never makes a visit billable.';
comment on column public.jobber_property_links.external_property_id is
  'Durable Jobber property identity. Never match a HomeAtlas property by name alone.';
