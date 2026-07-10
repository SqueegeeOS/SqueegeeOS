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
  updated_at timestamptz not null default now(),
  unique (property_id)
);

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

-- updated_at trigger helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

-- Row Level Security (permissive for internal app — tighten when auth is added)
alter table homeowners enable row level security;
alter table properties enable row level security;
alter table home_care_plans enable row level security;
alter table memberships enable row level security;
alter table signed_agreements enable row level security;
alter table property_assets enable row level security;

create policy "homeowners_anon_all" on homeowners for all using (true) with check (true);
create policy "properties_anon_all" on properties for all using (true) with check (true);
create policy "home_care_plans_anon_all" on home_care_plans for all using (true) with check (true);
create policy "memberships_anon_all" on memberships for all using (true) with check (true);
create policy "signed_agreements_anon_all" on signed_agreements for all using (true) with check (true);
create policy "property_assets_anon_all" on property_assets for all using (true) with check (true);

alter table closed_jobs enable row level security;
create policy "closed_jobs_anon_all" on closed_jobs for all using (true) with check (true);

alter table website_membership_sales enable row level security;
create policy "website_membership_sales_anon_all" on website_membership_sales for all using (true) with check (true);

alter table membership_billing_charges enable row level security;
create policy "membership_billing_charges_anon_all" on membership_billing_charges for all using (true) with check (true);

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
