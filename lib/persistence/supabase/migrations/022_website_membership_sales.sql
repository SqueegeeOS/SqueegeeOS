-- Migration 022: Website membership sales (presentation → sign → card on file → active)
-- Run after 021_visit_rate_overrides.sql
-- Safe to re-run: uses IF NOT EXISTS.

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
  on website_membership_sales (sold_at desc);

create index if not exists website_membership_sales_created_at_idx
  on website_membership_sales (created_at desc);

alter table website_membership_sales enable row level security;

drop policy if exists "website_membership_sales_anon_all" on website_membership_sales;
create policy "website_membership_sales_anon_all" on website_membership_sales
  for all using (true) with check (true);

comment on table website_membership_sales is
  'Immutable sale records for completed website signup (presentation → agreement → card on file → active). One row per membership.';
comment on column website_membership_sales.annualized_value is
  'visit_price × visits_per_year at time of sale';

-- ---------------------------------------------------------------------------
-- OPTIONAL one-time backfill (run manually after deploy if needed)
-- Captures real activations from deploy day only — e.g. Sylvia if she signed
-- before this migration shipped. Does not backfill mock/demo activations.
-- ---------------------------------------------------------------------------
-- insert into website_membership_sales (
--   membership_id, homeowner_id, property_id, presentation_id, agreement_id,
--   customer_name, customer_email, property_address, sales_tier,
--   visit_price, visits_per_year, annualized_value,
--   payment_setup_completed_at, sold_at, source
-- )
-- select
--   m.id,
--   m.homeowner_id,
--   m.property_id,
--   m.presentation_id,
--   m.agreement_id,
--   h.full_name,
--   h.email,
--   trim(concat_ws(', ', p.address, p.city, concat_ws(' ', p.state, p.zip))),
--   m.sales_tier,
--   m.visit_price,
--   m.visits_per_year,
--   round(m.visit_price * m.visits_per_year, 2),
--   m.payment_setup_completed_at,
--   m.payment_setup_completed_at,
--   'website_presentation'
-- from memberships m
-- join homeowners h on h.id = m.homeowner_id
-- join properties p on p.id = m.property_id
-- where m.status = 'active'
--   and m.payment_setup_completed_at is not null
--   and m.stripe_payment_method_id is not null
--   and m.presentation_id is not null
--   and m.agreement_id is not null
--   and m.sales_tier in ('biannual', 'quarterly')
--   and m.visit_price is not null
--   and m.visits_per_year is not null
--   and m.payment_setup_completed_at >= date '2026-07-09'
--   and not exists (
--     select 1 from website_membership_sales s where s.membership_id = m.id
--   );
