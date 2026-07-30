-- Audited Atlas Pulse founder confirmations.
-- Provider evidence remains in membership_communications. These rows record
-- an explicit human operational confirmation and never rewrite Resend state.

create table if not exists public.membership_activation_confirmations (
  membership_id uuid primary key references public.memberships(id) on delete restrict,
  email_complete boolean not null default false,
  email_confirmed_at timestamptz,
  email_confirmed_by text,
  portal_complete boolean not null default false,
  portal_confirmed_at timestamptz,
  portal_confirmed_by text,
  last_changed_by text not null,
  change_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(last_changed_by), '') is not null),
  check (nullif(trim(change_reason), '') is not null),
  check (
    (email_complete
      and email_confirmed_at is not null
      and nullif(trim(coalesce(email_confirmed_by, '')), '') is not null)
    or
    (not email_complete
      and email_confirmed_at is null
      and email_confirmed_by is null)
  ),
  check (
    (portal_complete
      and portal_confirmed_at is not null
      and nullif(trim(coalesce(portal_confirmed_by, '')), '') is not null)
    or
    (not portal_complete
      and portal_confirmed_at is null
      and portal_confirmed_by is null)
  )
);

drop trigger if exists membership_activation_confirmations_updated_at
  on public.membership_activation_confirmations;
create trigger membership_activation_confirmations_updated_at
  before update on public.membership_activation_confirmations
  for each row execute function public.set_updated_at();

create table if not exists public.membership_activation_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  milestone text not null check (milestone in ('welcome_email', 'portal_access')),
  event_type text not null check (event_type in ('confirmed', 'reopened')),
  actor text not null,
  reason text not null,
  occurred_at timestamptz not null default now(),
  check (nullif(trim(actor), '') is not null),
  check (nullif(trim(reason), '') is not null)
);

create index if not exists membership_activation_confirmation_events_membership_idx
  on public.membership_activation_confirmation_events(membership_id, occurred_at desc);

create or replace function public.audit_membership_activation_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.email_complete then
      insert into public.membership_activation_confirmation_events (
        membership_id, milestone, event_type, actor, reason, occurred_at
      ) values (
        new.membership_id,
        'welcome_email',
        'confirmed',
        new.last_changed_by,
        new.change_reason,
        new.email_confirmed_at
      );
    end if;

    if new.portal_complete then
      insert into public.membership_activation_confirmation_events (
        membership_id, milestone, event_type, actor, reason, occurred_at
      ) values (
        new.membership_id,
        'portal_access',
        'confirmed',
        new.last_changed_by,
        new.change_reason,
        new.portal_confirmed_at
      );
    end if;
    return new;
  end if;

  if new.email_complete is distinct from old.email_complete then
    insert into public.membership_activation_confirmation_events (
      membership_id, milestone, event_type, actor, reason, occurred_at
    ) values (
      new.membership_id,
      'welcome_email',
      case when new.email_complete then 'confirmed' else 'reopened' end,
      new.last_changed_by,
      new.change_reason,
      coalesce(new.email_confirmed_at, now())
    );
  end if;

  if new.portal_complete is distinct from old.portal_complete then
    insert into public.membership_activation_confirmation_events (
      membership_id, milestone, event_type, actor, reason, occurred_at
    ) values (
      new.membership_id,
      'portal_access',
      case when new.portal_complete then 'confirmed' else 'reopened' end,
      new.last_changed_by,
      new.change_reason,
      coalesce(new.portal_confirmed_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists membership_activation_confirmations_audit
  on public.membership_activation_confirmations;
create trigger membership_activation_confirmations_audit
  after insert or update on public.membership_activation_confirmations
  for each row execute function public.audit_membership_activation_confirmation();

create or replace function public.reject_membership_activation_confirmation_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'membership activation confirmation history is append-only and immutable';
end;
$$;

drop trigger if exists membership_activation_confirmation_events_immutable
  on public.membership_activation_confirmation_events;
create trigger membership_activation_confirmation_events_immutable
  before update or delete on public.membership_activation_confirmation_events
  for each row execute function public.reject_membership_activation_confirmation_event_change();

create or replace function public.reject_membership_activation_confirmation_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'membership activation confirmations must be reopened, never deleted';
end;
$$;

drop trigger if exists membership_activation_confirmations_no_delete
  on public.membership_activation_confirmations;
create trigger membership_activation_confirmations_no_delete
  before delete on public.membership_activation_confirmations
  for each row execute function public.reject_membership_activation_confirmation_delete();

alter table public.membership_activation_confirmations enable row level security;
alter table public.membership_activation_confirmation_events enable row level security;
-- No anon/authenticated policies. Founder confirmations are available only
-- through authenticated HQ routes using the service role.

comment on table public.membership_activation_confirmations is
  'Current founder-confirmed email and portal activation milestones; separate from provider telemetry';
comment on table public.membership_activation_confirmation_events is
  'Immutable audit history for founder-confirmed and reopened activation milestones';
