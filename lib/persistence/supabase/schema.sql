-- SqueegeeOS Supabase schema reference
-- Run in Supabase SQL editor when connecting cloud persistence.
-- Do not commit service role keys — use anon key client-side, service role server-side only.

create extension if not exists "pgcrypto";

-- Homeowners
create table if not exists homeowners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  full_name text not null,
  first_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Properties (central entity)
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  slug text not null,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null default '',
  type text not null default 'Residence',
  hero_image text,
  home_care_score smallint,
  health_status text,
  year_built smallint,
  square_feet integer,
  narrative text,
  last_visit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (homeowner_id, slug)
);

-- Home Care Plans (presentation JSON + optional draft)
create table if not exists home_care_plans (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid references homeowners(id) on delete set null,
  property_id uuid references properties(id) on delete cascade,
  homeowner_slug text not null,
  property_slug text not null,
  status text not null default 'generated',
  presentation jsonb not null,
  draft jsonb,
  storage_backend text not null default 'supabase',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (homeowner_slug, property_slug)
);

create index if not exists home_care_plans_property_id_idx on home_care_plans(property_id);

-- Memberships
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  home_care_plan_id uuid references home_care_plans(id) on delete set null,
  plan_id text not null,
  plan_name text not null,
  price_display text not null,
  billing_period text not null,
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  started_at timestamptz,
  founding_member boolean not null default false,
  founding_member_since timestamptz,
  portal_access_token text,
  portal_theme text check (portal_theme is null or portal_theme in ('day', 'night', 'lux')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists memberships_one_current_per_property_idx
  on memberships(property_id)
  where status in ('pending_checkout', 'pending_payment', 'active', 'paused');
create index if not exists memberships_property_history_idx
  on memberships(property_id, created_at desc);

-- Signed agreements
create table if not exists signed_agreements (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid references homeowners(id) on delete set null,
  property_id uuid references properties(id) on delete cascade,
  membership_id uuid references memberships(id) on delete set null,
  homeowner_slug text not null,
  property_slug text not null,
  homeowner_name text not null,
  plan_id text not null,
  plan_name text not null,
  signature_method text not null,
  signer_name text not null,
  signature_image_url text,
  typed_text text,
  signed_at timestamptz not null,
  ip_address text,
  user_agent text,
  client_session_id text,
  agreement_pdf_url text,
  signature_image_storage_path text,
  status text not null default 'pending',
  storage_backend text not null default 'supabase',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signed_agreements_property_idx
  on signed_agreements(homeowner_slug, property_slug);

-- Photos & documents (Supabase Storage + metadata)
create table if not exists property_assets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  kind text not null check (kind in ('photo', 'document')),
  category text not null default 'other',
  title text not null,
  description text,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  visit_id uuid,
  signed_agreement_id uuid references signed_agreements(id) on delete set null,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_assets_property_id_idx on property_assets(property_id);

-- Closed jobs / sales tracker (Admin Command Center)
create table if not exists closed_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  property_address text not null,
  sale_amount numeric(12, 2) not null check (sale_amount >= 0),
  sale_type text not null check (sale_type in ('one_time', 'recurring_membership')),
  recurring_frequency text check (
    recurring_frequency in ('monthly', 'quarterly', 'bi_annual', 'annual')
  ),
  service_category text not null,
  closed_date date not null,
  notes text not null default '',
  created_by text,
  status text not null default 'closed',
  created_at timestamptz not null default now()
);

create index if not exists closed_jobs_closed_date_idx on closed_jobs(closed_date desc);

-- Website membership sales (presentation → sign → card on file → active)
create table if not exists website_membership_sales (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  presentation_id uuid references presentations(id) on delete set null,
  agreement_id uuid references signed_agreements(id) on delete set null,
  customer_name text not null,
  customer_email text,
  property_address text not null,
  sales_tier text not null check (sales_tier in ('biannual', 'quarterly')),
  visit_price numeric(10, 2) not null check (visit_price >= 0),
  visits_per_year smallint not null check (visits_per_year > 0),
  annualized_value numeric(12, 2) not null check (annualized_value >= 0),
  payment_setup_completed_at timestamptz not null,
  sold_at timestamptz not null,
  source text not null default 'website_presentation'
    check (source in ('website_presentation')),
  created_at timestamptz not null default now(),
  unique (membership_id)
);

create index if not exists website_membership_sales_sold_at_idx
  on website_membership_sales(sold_at desc);

-- Manual billing charge ledger (Billing V2 placeholder)
create table if not exists membership_billing_charges (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  homeowner_id uuid references homeowners(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  service_month date not null,
  visit_price numeric(10, 2) check (visit_price is null or visit_price >= 0),
  amount numeric(10, 2) not null check (amount >= 0),
  amount_collected numeric(10, 2) check (amount_collected is null or amount_collected >= 0),
  status text not null check (status in ('paid', 'charged', 'failed', 'pending')),
  charged_at timestamptz,
  billing_method text check (
    billing_method is null
    or billing_method in ('manual_stripe', 'automatic_stripe')
  ),
  stripe_reference text,
  stripe_payment_intent_id text,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (membership_id, service_month)
);

create index if not exists membership_billing_charges_membership_id_idx
  on membership_billing_charges (membership_id);

create index if not exists membership_billing_charges_service_month_idx
  on membership_billing_charges (service_month desc);

-- updated_at trigger helper (secure search_path — see migration 030)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger homeowners_updated_at before update on homeowners
  for each row execute function set_updated_at();
create trigger properties_updated_at before update on properties
  for each row execute function set_updated_at();
create trigger home_care_plans_updated_at before update on home_care_plans
  for each row execute function set_updated_at();
create trigger memberships_updated_at before update on memberships
  for each row execute function set_updated_at();
create trigger signed_agreements_updated_at before update on signed_agreements
  for each row execute function set_updated_at();
create trigger property_assets_updated_at before update on property_assets
  for each row execute function set_updated_at();

-- Row Level Security
-- Server routes use service role (bypasses RLS). Customer, HQ, billing, and
-- ledger tables have no anonymous data access.
alter table homeowners enable row level security;
alter table properties enable row level security;
alter table home_care_plans enable row level security;
alter table memberships enable row level security;
alter table signed_agreements enable row level security;
alter table property_assets enable row level security;

-- Customer authority tables are server/service-role only. Browser reads and
-- writes go through authenticated Next.js route handlers.
revoke all privileges on table homeowners from public, anon, authenticated;
revoke all privileges on table properties from public, anon, authenticated;
revoke all privileges on table home_care_plans from public, anon, authenticated;
revoke all privileges on table memberships from public, anon, authenticated;
revoke all privileges on table signed_agreements from public, anon, authenticated;
revoke all privileges on table property_assets from public, anon, authenticated;

grant select, insert, update, delete on table homeowners to service_role;
grant select, insert, update, delete on table properties to service_role;
grant select, insert, update, delete on table home_care_plans to service_role;
grant select, insert, update, delete on table memberships to service_role;
grant select, insert, update, delete on table signed_agreements to service_role;
grant select, insert, update, delete on table property_assets to service_role;

create table if not exists admin_unlock_rate_limits (
  identity_hash text primary key,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_unlock_identity_hash_length
    check (char_length(identity_hash) between 32 and 128)
);

alter table admin_unlock_rate_limits enable row level security;
revoke all privileges on table admin_unlock_rate_limits
  from public, anon, authenticated;
grant select, insert, update, delete on table admin_unlock_rate_limits
  to service_role;

create trigger admin_unlock_rate_limits_set_updated_at
before update on admin_unlock_rate_limits
for each row execute function set_updated_at();

create or replace function public.check_admin_unlock_rate_limit(
  p_identity_hash text
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lock timestamptz;
  current_time timestamptz := clock_timestamp();
begin
  select locked_until into current_lock
  from public.admin_unlock_rate_limits
  where identity_hash = p_identity_hash;

  if not found or current_lock is null or current_lock <= current_time then
    return query select true, 0;
    return;
  end if;

  return query
    select false, greatest(1, ceil(extract(epoch from (current_lock - current_time)))::integer);
end;
$$;

create or replace function public.record_admin_unlock_attempt(
  p_identity_hash text,
  p_succeeded boolean,
  p_max_failures integer default 5,
  p_window_seconds integer default 900,
  p_lock_seconds integer default 900
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.admin_unlock_rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
  next_failures integer;
  next_lock timestamptz;
begin
  if char_length(p_identity_hash) < 32
     or p_max_failures < 1
     or p_window_seconds < 1
     or p_lock_seconds < 1 then
    raise exception 'Invalid admin unlock rate-limit input';
  end if;

  if p_succeeded then
    delete from public.admin_unlock_rate_limits
    where identity_hash = p_identity_hash;
    return query select true, 0;
    return;
  end if;

  insert into public.admin_unlock_rate_limits (identity_hash)
  values (p_identity_hash)
  on conflict (identity_hash) do nothing;

  select * into attempt_row
  from public.admin_unlock_rate_limits
  where identity_hash = p_identity_hash
  for update;

  if attempt_row.locked_until is not null
     and attempt_row.locked_until > current_time then
    return query
      select false,
        greatest(1, ceil(extract(epoch from (attempt_row.locked_until - current_time)))::integer);
    return;
  end if;

  if attempt_row.window_started_at
     <= current_time - make_interval(secs => p_window_seconds) then
    attempt_row.window_started_at := current_time;
    attempt_row.failed_attempts := 0;
  end if;

  next_failures := attempt_row.failed_attempts + 1;
  next_lock := case
    when next_failures >= p_max_failures
      then current_time + make_interval(secs => p_lock_seconds)
    else null
  end;

  update public.admin_unlock_rate_limits
  set window_started_at = attempt_row.window_started_at,
      failed_attempts = next_failures,
      locked_until = next_lock,
      updated_at = current_time
  where identity_hash = p_identity_hash;

  if next_lock is not null then
    return query select false, p_lock_seconds;
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_admin_unlock_rate_limit(text)
  from public, anon, authenticated;
revoke all on function public.record_admin_unlock_attempt(text, boolean, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_admin_unlock_rate_limit(text)
  to service_role;
grant execute on function public.record_admin_unlock_attempt(text, boolean, integer, integer, integer)
  to service_role;

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
  with customer_tables(table_name) as (
    values
      ('homeowners'),
      ('properties'),
      ('home_care_plans'),
      ('memberships'),
      ('signed_agreements'),
      ('property_assets')
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
        and p.tablename in (select table_name from customer_tables)
        and (
          'anon' = any(p.roles)
          or 'authenticated' = any(p.roles)
          or 'public' = any(p.roles)
        )
    ),
    (
      select count(*)
      from customer_tables t
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

alter table closed_jobs enable row level security;

alter table website_membership_sales enable row level security;

alter table membership_billing_charges enable row level security;

-- ---------------------------------------------------------------------------
-- Member Intelligence System (see migrations/005_member_intelligence.sql)
-- ---------------------------------------------------------------------------

alter table properties add column if not exists zillow_url text;
alter table properties add column if not exists property_details jsonb not null default '{}'::jsonb;
alter table properties add column if not exists access_instructions text;
alter table properties add column if not exists service_notes jsonb not null default '[]'::jsonb;
alter table properties add column if not exists preferred_products jsonb not null default '[]'::jsonb;

alter table property_assets add column if not exists photo_source text
  check (photo_source is null or photo_source in ('zillow', 'our_team', 'member_uploaded', 'internal'));
alter table property_assets add column if not exists is_primary boolean not null default false;
alter table property_assets add column if not exists external_url text;

alter table presentations add column if not exists enrollment_savings numeric(10, 2);
alter table memberships add column if not exists membership_enrollment_savings numeric(10, 2);

-- member_profiles, member_savings_transactions, member_appointments,
-- service_observations, ai_quotes — see 005_member_intelligence.sql
