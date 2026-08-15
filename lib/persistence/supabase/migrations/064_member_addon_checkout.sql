-- Customer-approved payment links for arbitrary HomeAtlas add-on services.
-- Jobber-scheduled work remains on the separate standing-authorization lane.

alter table public.member_addon_transactions
  add column if not exists payment_status text not null default 'record_only'
    check (payment_status in (
      'record_only', 'checkout_open', 'paid', 'failed', 'expired'
    )),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_url text,
  add column if not exists payment_url_expires_at timestamptz,
  add column if not exists customer_approved_at timestamptz,
  add column if not exists checkout_attempt integer not null default 0
    check (checkout_attempt >= 0 and checkout_attempt <= 25);

create unique index if not exists member_addon_checkout_session_unique
  on public.member_addon_transactions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists member_addon_payment_intent_unique
  on public.member_addon_transactions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists member_addon_payment_status_idx
  on public.member_addon_transactions(payment_status, updated_at desc);

comment on column public.member_addon_transactions.payment_status is
  'Collection state. checkout_open means the customer must approve Stripe Checkout; it is never an off-session charge.';
comment on column public.member_addon_transactions.payment_url is
  'Short-lived Stripe-hosted Checkout URL. Private HQ/server data only.';
comment on column public.member_addon_transactions.customer_approved_at is
  'Stripe-confirmed customer payment time; required before checkout revenue is marked paid.';

-- The original table shipped with an anonymous-all policy. Payment URLs and
-- provider references make that unsafe; all access now goes through the
-- server-authorized HQ and portal repositories.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_addon_transactions'
  loop
    execute format(
      'drop policy if exists %I on public.member_addon_transactions',
      policy_record.policyname
    );
  end loop;
end;
$$;

revoke all privileges on table public.member_addon_transactions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.member_addon_transactions
  to service_role;
