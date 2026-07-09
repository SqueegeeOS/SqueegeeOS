-- Referral program v1: codes, visit tracking, referral lifecycle.
-- Loose coupling (text ids, no cross-domain FKs) so referral history
-- survives lead/membership cleanup; rewards wiring comes later.

create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  membership_id text not null unique,
  member_name text not null default '',
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists referral_visits (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references referral_codes(id) on delete cascade,
  visited_at timestamptz not null default now(),
  user_agent text,
  referer text
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references referral_codes(id) on delete cascade,
  lead_id text,
  lead_name text not null default '',
  lead_email text not null default '',
  converted_membership_id text,
  status text not null default 'pending'
    check (status in ('pending','converted','rewarded','expired','cancelled')),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  rewarded_at timestamptz,
  notes text not null default ''
);

create index if not exists referral_visits_code_idx on referral_visits (referral_code_id, visited_at desc);
create index if not exists referrals_code_idx on referrals (referral_code_id, created_at desc);
create index if not exists referrals_lead_idx on referrals (lead_id);
create index if not exists referrals_lead_email_idx on referrals (lead_email);
