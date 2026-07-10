-- Migration 028: Member savings ledger + referral milestone rewards
-- Run after 027_member_addon_transactions.sql

create table if not exists member_savings_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  member_profile_id uuid references member_profiles(id) on delete set null,
  entry_type text not null
    check (entry_type in ('membership_visit', 'addon_service')),
  source_id text not null,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (entry_type, source_id)
);

create index if not exists member_savings_ledger_membership_idx
  on member_savings_ledger_entries(membership_id, occurred_at desc);

comment on table member_savings_ledger_entries is
  'Customer-facing service savings ledger — membership visits and add-ons only (not referral credits).';

create table if not exists member_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  membership_id text not null,
  milestone_converted_count integer not null check (milestone_converted_count > 0),
  reward_type text not null
    check (reward_type in ('care_credit', 'percent_discount')),
  reward_label text not null,
  value_cents integer check (value_cents is null or value_cents >= 0),
  value_percent smallint check (value_percent is null or value_percent between 1 and 100),
  status text not null default 'available'
    check (status in ('earned', 'available', 'redeemed', 'expired')),
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz,
  notes text,
  unique (membership_id, milestone_converted_count)
);

create index if not exists member_referral_rewards_membership_idx
  on member_referral_rewards(membership_id, earned_at desc);

comment on table member_referral_rewards is
  'HomeAtlas Care Credits and milestone rewards from converted member referrals — tracked separately from service savings.';

alter table member_savings_ledger_entries enable row level security;
alter table member_referral_rewards enable row level security;

drop policy if exists member_savings_ledger_entries_anon_all on member_savings_ledger_entries;
create policy member_savings_ledger_entries_anon_all on member_savings_ledger_entries
  for all using (true) with check (true);

drop policy if exists member_referral_rewards_anon_all on member_referral_rewards;
create policy member_referral_rewards_anon_all on member_referral_rewards
  for all using (true) with check (true);
