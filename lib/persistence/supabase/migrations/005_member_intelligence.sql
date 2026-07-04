-- Member Intelligence System — Phase 1 foundation
-- Member Profile + Property Intelligence + AI Quote Engine
-- Run after schema.sql (or prior migrations). Idempotent where possible.

-- ---------------------------------------------------------------------------
-- Property intelligence extensions
-- ---------------------------------------------------------------------------

alter table properties add column if not exists zillow_url text;
alter table properties add column if not exists property_details jsonb not null default '{}'::jsonb;
alter table properties add column if not exists access_instructions text;
alter table properties add column if not exists service_notes jsonb not null default '[]'::jsonb;
alter table properties add column if not exists preferred_products jsonb not null default '[]'::jsonb;

comment on column properties.property_details is
  'Structured home facts for AI quotes: sqft, beds, baths, roof, windows, pool, etc.';

-- Photo source priority (zillow → our_team → member_uploaded)
alter table property_assets add column if not exists photo_source text
  check (photo_source is null or photo_source in ('zillow', 'our_team', 'member_uploaded', 'internal'));
alter table property_assets add column if not exists is_primary boolean not null default false;
alter table property_assets add column if not exists external_url text;

create index if not exists property_assets_primary_idx
  on property_assets(property_id, is_primary desc)
  where kind = 'photo';

-- ---------------------------------------------------------------------------
-- System 1 — Member Profile Engine
-- ---------------------------------------------------------------------------

create table if not exists member_profiles (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null unique references homeowners(id) on delete cascade,
  membership_tier text not null default 'standard'
    check (membership_tier in ('standard', 'premium', 'elite')),
  total_saved_cents integer not null default 0 check (total_saved_cents >= 0),
  preferred_services jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_savings_transactions (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  appointment_id uuid,
  service_type text not null,
  regular_price_cents integer not null check (regular_price_cents >= 0),
  member_price_cents integer not null check (member_price_cents >= 0),
  saved_cents integer not null check (saved_cents >= 0),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists member_savings_profile_idx
  on member_savings_transactions(member_profile_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

create table if not exists member_appointments (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  service_type text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  technician_name text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_appointments_property_idx
  on member_appointments(property_id, scheduled_at desc);
create index if not exists member_appointments_upcoming_idx
  on member_appointments(member_profile_id, scheduled_at)
  where status = 'scheduled';

-- Link savings to appointments (deferred FK)
alter table member_savings_transactions
  drop constraint if exists member_savings_transactions_appointment_id_fkey;
alter table member_savings_transactions
  add constraint member_savings_transactions_appointment_id_fkey
  foreign key (appointment_id) references member_appointments(id) on delete set null;

-- Link property_assets.visit_id to real visits
alter table property_assets
  drop constraint if exists property_assets_visit_id_fkey;
alter table property_assets
  add constraint property_assets_visit_id_fkey
  foreign key (visit_id) references member_appointments(id) on delete set null;

-- ---------------------------------------------------------------------------
-- System 3 — Field observations + AI quotes
-- ---------------------------------------------------------------------------

create table if not exists service_observations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  member_profile_id uuid references member_profiles(id) on delete set null,
  appointment_id uuid references member_appointments(id) on delete set null,
  observed_by text,
  home_condition text check (
    home_condition is null or home_condition in ('excellent', 'good', 'fair', 'rough')
  ),
  observation_flags jsonb not null default '[]'::jsonb,
  homeowner_vibe text check (
    homeowner_vibe is null or homeowner_vibe in ('proud', 'practical', 'busy', 'skeptical')
  ),
  notes text not null default '',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists service_observations_property_idx
  on service_observations(property_id, observed_at desc);

create table if not exists ai_quotes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  member_profile_id uuid references member_profiles(id) on delete set null,
  observation_id uuid references service_observations(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'sent', 'accepted', 'declined')),
  field_inputs jsonb not null default '{}'::jsonb,
  generated_text text,
  model text,
  prompt_version text not null default 'v1',
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_quotes_property_idx
  on ai_quotes(property_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers + RLS (permissive until Supabase Auth ships)
-- ---------------------------------------------------------------------------

drop trigger if exists member_profiles_updated_at on member_profiles;
create trigger member_profiles_updated_at before update on member_profiles
  for each row execute function set_updated_at();

drop trigger if exists member_appointments_updated_at on member_appointments;
create trigger member_appointments_updated_at before update on member_appointments
  for each row execute function set_updated_at();

drop trigger if exists ai_quotes_updated_at on ai_quotes;
create trigger ai_quotes_updated_at before update on ai_quotes
  for each row execute function set_updated_at();

alter table member_profiles enable row level security;
alter table member_savings_transactions enable row level security;
alter table member_appointments enable row level security;
alter table service_observations enable row level security;
alter table ai_quotes enable row level security;

drop policy if exists "member_profiles_anon_all" on member_profiles;
create policy "member_profiles_anon_all" on member_profiles for all using (true) with check (true);

drop policy if exists "member_savings_anon_all" on member_savings_transactions;
create policy "member_savings_anon_all" on member_savings_transactions for all using (true) with check (true);

drop policy if exists "member_appointments_anon_all" on member_appointments;
create policy "member_appointments_anon_all" on member_appointments for all using (true) with check (true);

drop policy if exists "service_observations_anon_all" on service_observations;
create policy "service_observations_anon_all" on service_observations for all using (true) with check (true);

drop policy if exists "ai_quotes_anon_all" on ai_quotes;
create policy "ai_quotes_anon_all" on ai_quotes for all using (true) with check (true);
