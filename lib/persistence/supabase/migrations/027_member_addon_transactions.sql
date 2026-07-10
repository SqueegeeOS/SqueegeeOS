-- Migration 027: Member add-on revenue (one-off services sold to members)
-- Run after 026_referral_program.sql
-- Safe to re-run: uses IF NOT EXISTS.

create table if not exists member_addon_transactions (
  id uuid primary key default gen_random_uuid(),

  membership_id uuid not null references memberships(id) on delete cascade,
  member_profile_id uuid references member_profiles(id) on delete set null,
  property_id uuid not null references properties(id) on delete cascade,

  service_name text not null,
  service_date date not null,

  retail_price_cents integer not null check (retail_price_cents >= 0),
  discount_percent smallint not null check (discount_percent between 0 and 100),
  amount_charged_cents integer not null check (amount_charged_cents >= 0),
  saved_cents integer not null check (saved_cents >= 0),

  sales_tier text check (sales_tier in ('biannual', 'quarterly')),

  status text not null default 'paid'
    check (status in ('quoted', 'scheduled', 'completed', 'paid')),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_addon_membership_idx
  on member_addon_transactions(membership_id, service_date desc);

create index if not exists member_addon_property_idx
  on member_addon_transactions(property_id, service_date desc);

create index if not exists member_addon_status_idx
  on member_addon_transactions(status, service_date desc);

comment on table member_addon_transactions is
  'One-off add-on services sold to members — revenue and member savings, separate from membership visit billing.';

comment on column member_addon_transactions.amount_charged_cents is
  'Collected revenue for this add-on (v1 manual entry).';

comment on column member_addon_transactions.saved_cents is
  'Member discount value: retail_price_cents - amount_charged_cents.';

alter table member_addon_transactions enable row level security;

drop policy if exists member_addon_transactions_anon_all on member_addon_transactions;
create policy member_addon_transactions_anon_all on member_addon_transactions
  for all using (true) with check (true);
