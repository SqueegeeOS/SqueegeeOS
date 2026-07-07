-- Phase 1: Presentation sign → homeowner / property / membership onboarding
-- Run after 010_presentation_quote_snapshot.sql

-- ---------------------------------------------------------------------------
-- presentations
-- ---------------------------------------------------------------------------
alter table presentations
  add column if not exists homeowner_id uuid references homeowners(id) on delete set null,
  add column if not exists property_id uuid references properties(id) on delete set null,
  add column if not exists membership_id uuid references memberships(id) on delete set null,
  add column if not exists onboarding_status text
    check (onboarding_status is null or onboarding_status in ('pending_payment', 'complete'));

create index if not exists presentations_membership_id_idx
  on presentations(membership_id);
create index if not exists presentations_homeowner_id_idx
  on presentations(homeowner_id);
create index if not exists presentations_onboarding_status_idx
  on presentations(onboarding_status);

comment on column presentations.onboarding_status is
  'pending_payment = signed agreement on file, card not saved; complete = payment setup done';

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
alter table memberships
  add column if not exists presentation_id uuid references presentations(id) on delete set null,
  add column if not exists agreement_id uuid references signed_agreements(id) on delete set null,
  add column if not exists sales_tier text
    check (sales_tier is null or sales_tier in ('biannual', 'quarterly')),
  add column if not exists visit_price numeric(10,2),
  add column if not exists annual_rate numeric(10,2),
  add column if not exists visits_per_year smallint,
  add column if not exists billing_schedule text not null default 'first_of_service_month',
  add column if not exists next_billing_date date,
  add column if not exists payment_setup_completed_at timestamptz,
  add column if not exists stripe_payment_method_id text;

alter table memberships drop constraint if exists memberships_status_check;
alter table memberships
  add constraint memberships_status_check
  check (status in (
    'inactive',
    'pending_checkout',
    'pending_payment',
    'active',
    'paused',
    'cancelled'
  ));

create index if not exists memberships_presentation_id_idx
  on memberships(presentation_id);
create index if not exists memberships_status_idx
  on memberships(status);

comment on column memberships.billing_schedule is
  'first_of_service_month — charged on the 1st of the month the visit is scheduled';
comment on column memberships.stripe_payment_method_id is
  'Stripe PaymentMethod id (pm_...) — never store raw card data';

-- ---------------------------------------------------------------------------
-- signed_agreements
-- ---------------------------------------------------------------------------
alter table signed_agreements
  add column if not exists presentation_id uuid references presentations(id) on delete set null;

create index if not exists signed_agreements_presentation_id_idx
  on signed_agreements(presentation_id);
create index if not exists signed_agreements_membership_id_idx
  on signed_agreements(membership_id);
