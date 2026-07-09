-- Migration 024: Manual billing charge ledger (Billing V2 placeholder)
-- Run after 023_enrollment_savings.sql
-- V1: read-only in app — founders log charges manually in Stripe; optional rows here later.

create table if not exists membership_billing_charges (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  service_month date not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null check (status in ('charged', 'failed', 'pending')),
  charged_at timestamptz,
  stripe_payment_intent_id text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (membership_id, service_month)
);

create index if not exists membership_billing_charges_membership_id_idx
  on membership_billing_charges (membership_id);

create index if not exists membership_billing_charges_service_month_idx
  on membership_billing_charges (service_month desc);

alter table membership_billing_charges enable row level security;

drop policy if exists "membership_billing_charges_anon_all" on membership_billing_charges;
create policy "membership_billing_charges_anon_all" on membership_billing_charges
  for all using (true) with check (true);

comment on table membership_billing_charges is
  'Manual billing ledger — V1 charges run in Stripe dashboard; rows optional until Billing V2';
