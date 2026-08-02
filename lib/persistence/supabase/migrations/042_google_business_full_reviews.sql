-- Durable, encrypted Google Business Profile OAuth state for the owned
-- SqueegeeKing location. Review content continues to flow through the
-- server-side Google API cache; this table stores credentials and identifiers
-- only, never public customer data.

create table if not exists public.google_business_connections (
  id text primary key default 'squeegeeking' check (id = 'squeegeeking'),
  status text not null default 'connected' check (
    status in ('connected', 'refresh_required', 'disconnected', 'error')
  ),
  account_name text not null,
  location_name text not null,
  location_title text not null,
  place_id text,
  oauth_email text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  token_generation bigint not null default 1 check (token_generation > 0),
  connection_revision uuid not null default gen_random_uuid(),
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_full_sync_at timestamptz,
  last_full_review_count integer check (
    last_full_review_count is null or last_full_review_count >= 0
  ),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_name, location_name)
);

-- Keep the migration safe to re-run if an earlier draft was applied. Google
-- service-area businesses do not always expose a Places resource, so the
-- Business Profile account/location resource names remain the durable identity.
alter table public.google_business_connections
  add column if not exists oauth_email text;
alter table public.google_business_connections
  add column if not exists connection_revision uuid not null default gen_random_uuid();
alter table public.google_business_connections
  alter column place_id drop not null;

drop trigger if exists google_business_connections_updated_at
  on public.google_business_connections;
create trigger google_business_connections_updated_at
  before update on public.google_business_connections
  for each row execute function public.set_updated_at();

alter table public.google_business_connections enable row level security;

-- Remove any public-facing policies if the migration is re-run after a manual
-- policy was added. OAuth credentials must only be reachable by service_role.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_connections'
      and (
        'anon' = any(roles)
        or 'authenticated' = any(roles)
        or 'public' = any(roles)
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

revoke all privileges on table public.google_business_connections
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.google_business_connections to service_role;

comment on table public.google_business_connections is
  'Encrypted OAuth state for the owned SqueegeeKing Google Business Profile; service-role only';
comment on column public.google_business_connections.access_token_ciphertext is
  'AES-256-GCM ciphertext; plaintext OAuth tokens must never be stored or logged';
comment on column public.google_business_connections.refresh_token_ciphertext is
  'AES-256-GCM ciphertext used for unattended full-review synchronization';
comment on column public.google_business_connections.oauth_email is
  'OAuth principal email used only to prevent credential reuse across different Google identities';
comment on column public.google_business_connections.place_id is
  'Optional Google Places identifier; service-area profiles may not expose one';

-- Keep the existing security-posture RPC authoritative for this new sensitive
-- credential table without changing the RPC return contract consumed by HQ.
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
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events'),
      ('google_business_connections')
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
