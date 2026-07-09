-- Migration 025: Billing ledger V1.1 — manual charge recording
-- Run after 024_membership_billing_charges.sql

alter table membership_billing_charges
  add column if not exists homeowner_id uuid references homeowners(id) on delete cascade,
  add column if not exists property_id uuid references properties(id) on delete cascade,
  add column if not exists visit_price numeric(10, 2) check (visit_price is null or visit_price >= 0),
  add column if not exists amount_collected numeric(10, 2) check (amount_collected is null or amount_collected >= 0),
  add column if not exists billing_method text,
  add column if not exists stripe_reference text,
  add column if not exists created_by text not null default '';

update membership_billing_charges
set amount_collected = amount
where amount_collected is null and amount is not null;

alter table membership_billing_charges
  drop constraint if exists membership_billing_charges_status_check;

alter table membership_billing_charges
  add constraint membership_billing_charges_status_check
  check (status in ('paid', 'charged', 'failed', 'pending'));

alter table membership_billing_charges
  drop constraint if exists membership_billing_charges_billing_method_check;

alter table membership_billing_charges
  add constraint membership_billing_charges_billing_method_check
  check (
    billing_method is null
    or billing_method in ('manual_stripe', 'automatic_stripe')
  );

comment on column membership_billing_charges.service_month is
  'Billing period — 1st of the service month being charged';
comment on column membership_billing_charges.amount_collected is
  'Amount collected for this billing period';
comment on column membership_billing_charges.billing_method is
  'manual_stripe | automatic_stripe — same ledger for HQ and future webhooks';
comment on column membership_billing_charges.stripe_reference is
  'Optional Stripe payment intent, charge, or dashboard reference';
