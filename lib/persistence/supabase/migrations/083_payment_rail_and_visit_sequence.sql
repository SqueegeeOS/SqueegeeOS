-- Durable payment rails for HomeAtlas enrollment.
--
-- Existing memberships remain Stripe-card accounts. A cash/check account must
-- carry explicit owner approval, can never enable automatic billing, and never
-- enters Stripe setup or charge execution. This migration sends no messages,
-- creates no Stripe objects, and charges no customer.

begin;

alter table public.enrollment_packets
  add column if not exists payment_rail text not null default 'stripe_card',
  add column if not exists manual_payment_approved_at timestamptz,
  add column if not exists manual_payment_approved_by text;

alter table public.enrollment_packets
  drop constraint if exists enrollment_packets_payment_rail_check,
  drop constraint if exists enrollment_packets_manual_payment_approval_check;

alter table public.enrollment_packets
  add constraint enrollment_packets_payment_rail_check check (
    payment_rail in ('stripe_card', 'manual_cash_check')
  ),
  add constraint enrollment_packets_manual_payment_approval_check check (
    (
      payment_rail = 'stripe_card'
      and manual_payment_approved_at is null
      and manual_payment_approved_by is null
    )
    or
    (
      payment_rail = 'manual_cash_check'
      and manual_payment_approved_at is not null
      and nullif(trim(coalesce(manual_payment_approved_by, '')), '') is not null
      and char_length(manual_payment_approved_by) <= 100
    )
  );

alter table public.memberships
  add column if not exists payment_rail text not null default 'stripe_card',
  add column if not exists manual_payment_approved_at timestamptz,
  add column if not exists manual_payment_approved_by text;

alter table public.memberships
  drop constraint if exists memberships_payment_rail_check,
  drop constraint if exists memberships_manual_payment_approval_check;

alter table public.memberships
  add constraint memberships_payment_rail_check check (
    payment_rail in ('stripe_card', 'manual_cash_check')
  ),
  add constraint memberships_manual_payment_approval_check check (
    (
      payment_rail = 'stripe_card'
      and manual_payment_approved_at is null
      and manual_payment_approved_by is null
    )
    or
    (
      payment_rail = 'manual_cash_check'
      and manual_payment_approved_at is not null
      and nullif(trim(coalesce(manual_payment_approved_by, '')), '') is not null
      and char_length(manual_payment_approved_by) <= 100
      and automatic_billing_enabled = false
    )
  );

alter table public.signed_agreements
  add column if not exists payment_rail text not null default 'stripe_card';

alter table public.signed_agreements
  drop constraint if exists signed_agreements_payment_rail_check;

alter table public.signed_agreements
  add constraint signed_agreements_payment_rail_check check (
    payment_rail in ('stripe_card', 'manual_cash_check')
  );

create index if not exists memberships_payment_rail_status_idx
  on public.memberships(payment_rail, status, updated_at desc);

create index if not exists enrollment_packets_payment_rail_status_idx
  on public.enrollment_packets(payment_rail, status, updated_at desc);

comment on column public.memberships.payment_rail is
  'Collection rail selected at enrollment. manual_cash_check is owner-approved, never eligible for Stripe or automatic billing.';
comment on column public.memberships.manual_payment_approved_at is
  'Owner approval timestamp for a trusted cash/check account. This is not evidence that an invoice was paid.';
comment on column public.memberships.manual_payment_approved_by is
  'Auditable owner identity that approved the cash/check collection rail.';
comment on column public.enrollment_packets.payment_rail is
  'Immutable enrollment choice after DocuSign begins: Stripe card setup or owner-approved cash/check collection.';
comment on column public.signed_agreements.payment_rail is
  'Payment arrangement frozen with the signed agreement snapshot.';

commit;
