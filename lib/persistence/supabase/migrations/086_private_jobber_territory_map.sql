-- Migration 086: private, cache-backed coordinates for the field sales proof map.
-- Jobber remains the customer, property, and completed-work authority. Google
-- Places resolves service addresses; this table prevents repeated geocoding.

begin;

alter table public.jobber_visit_projections
  add column if not exists property_name text;
alter table public.jobber_visit_projections
  add column if not exists property_address jsonb;

create table if not exists public.jobber_territory_geocodes (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null
    references public.jobber_connections(id) on delete restrict,
  external_property_id text not null,
  source_address text not null,
  source_address_hash text not null,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'resolved', 'not_found', 'error')),
  provider text not null default 'google_places_text_search'
    check (provider = 'google_places_text_search'),
  provider_place_id text,
  source_observed_at timestamptz,
  last_geocoded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_property_id),
  constraint jobber_territory_geocodes_property_check
    check (char_length(btrim(external_property_id)) between 1 and 500),
  constraint jobber_territory_geocodes_address_check
    check (char_length(btrim(source_address)) between 5 and 500),
  constraint jobber_territory_geocodes_hash_check
    check (source_address_hash ~ '^[a-f0-9]{64}$'),
  constraint jobber_territory_geocodes_location_check
    check (
      (
        geocode_status = 'resolved'
        and latitude between -90 and 90
        and longitude between -180 and 180
        and nullif(btrim(coalesce(formatted_address, '')), '') is not null
      )
      or
      (
        geocode_status <> 'resolved'
        and latitude is null
        and longitude is null
      )
    )
);

create index if not exists jobber_territory_geocodes_status_idx
  on public.jobber_territory_geocodes(connection_id, geocode_status, updated_at);

drop trigger if exists jobber_territory_geocodes_updated_at
  on public.jobber_territory_geocodes;
create trigger jobber_territory_geocodes_updated_at
  before update on public.jobber_territory_geocodes
  for each row execute function public.set_updated_at();

alter table public.jobber_territory_geocodes enable row level security;
revoke all privileges on table public.jobber_territory_geocodes
  from public, anon, authenticated;
grant select, insert, update, delete on table public.jobber_territory_geocodes
  to service_role;

comment on table public.jobber_territory_geocodes is
  'Private coordinate cache for completed Jobber properties shown to authorized field staff';

-- Keep Production Health aware of the new table containing exact customer
-- service locations while preserving the existing RPC response shape.
create or replace function public.homeatlas_security_posture()
returns table(
  customer_public_policy_count bigint,
  customer_public_privilege_count bigint,
  admin_rate_limit_ready boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sensitive_tables(table_name) as (
    values
      ('homeowners'),
      ('properties'),
      ('home_care_plans'),
      ('memberships'),
      ('signed_agreements'),
      ('property_assets'),
      ('presentations'),
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events'),
      ('customer_contact_consent_events'),
      ('customer_communication_provider_verifications'),
      ('google_business_connections'),
      ('sales_reps'),
      ('sales_rep_leads'),
      ('sales_rep_activity_events'),
      ('sales_rep_attributions'),
      ('jobber_territory_geocodes')
  ),
  public_roles(role_name) as (
    values ('anon'), ('authenticated')
  ),
  table_privileges(privilege_name) as (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  )
  select
    (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in (select table_name from sensitive_tables)
        and (
          'anon' = any(p.roles)
          or 'authenticated' = any(p.roles)
          or 'public' = any(p.roles)
        )
    ),
    (
      select count(*)
      from sensitive_tables t
      cross join public_roles r
      cross join table_privileges p
      where has_table_privilege(
        r.role_name,
        format('public.%I', t.table_name),
        p.privilege_name
      )
    ),
    to_regclass('public.admin_unlock_rate_limits') is not null;
$$;

revoke all on function public.homeatlas_security_posture()
  from public, anon, authenticated;
grant execute on function public.homeatlas_security_posture()
  to service_role;

commit;
