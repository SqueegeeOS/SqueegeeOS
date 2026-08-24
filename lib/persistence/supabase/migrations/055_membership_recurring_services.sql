-- Itemized recurring services that supplement a membership's signed base plan.
-- These rows preserve cadence, pricing, billing timing, and consent evidence
-- without rewriting the signed base visit price.

create table if not exists public.membership_recurring_services (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  homeowner_id uuid not null references public.homeowners(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  service_key text not null check (service_key ~ '^[a-z0-9_]+$'),
  service_name text not null check (nullif(trim(service_name), '') is not null),
  visits_per_year smallint not null check (visits_per_year between 1 and 12),
  price_per_visit_cents integer not null check (price_per_visit_cents > 0),
  annual_value_cents integer generated always as
    (visits_per_year::integer * price_per_visit_cents) stored,
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  billing_schedule text not null default 'first_of_service_month'
    check (billing_schedule = 'first_of_service_month'),
  billing_authorization_status text not null default 'not_authorized'
    check (billing_authorization_status in ('authorized', 'not_authorized', 'revoked')),
  billing_authorization_source text
    check (
      billing_authorization_source is null
      or billing_authorization_source in (
        'customer_signed_amendment',
        'customer_portal_confirmation',
        'owner_attested_verbal_consent'
      )
    ),
  authorization_attested_at timestamptz,
  authorization_attested_by text,
  authorization_note text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, service_key),
  check (
    (billing_authorization_status = 'authorized'
      and billing_authorization_source is not null
      and authorization_attested_at is not null
      and nullif(trim(coalesce(authorization_attested_by, '')), '') is not null)
    or
    (billing_authorization_status <> 'authorized')
  )
);

create index if not exists membership_recurring_services_membership_idx
  on public.membership_recurring_services(membership_id, status);

create index if not exists membership_recurring_services_property_idx
  on public.membership_recurring_services(property_id, status);

drop trigger if exists membership_recurring_services_updated_at
  on public.membership_recurring_services;
create trigger membership_recurring_services_updated_at
  before update on public.membership_recurring_services
  for each row execute function public.set_updated_at();

comment on table public.membership_recurring_services is
  'Itemized recurring service commitments that supplement, but never rewrite, a signed base membership plan.';
comment on column public.membership_recurring_services.annual_value_cents is
  'Generated recurring annual value for the itemized service: cadence multiplied by per-visit price.';
comment on column public.membership_recurring_services.authorization_attested_at is
  'When HomeAtlas recorded the authorization evidence; not necessarily when the customer originally gave consent.';

alter table public.membership_recurring_services enable row level security;

revoke all privileges on table public.membership_recurring_services
  from public, anon, authenticated;
grant select, insert, update, delete on table public.membership_recurring_services
  to service_role;
