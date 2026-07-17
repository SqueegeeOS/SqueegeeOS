-- Migration 036: Referral reward claim lifecycle (Lux Referral Rewards PR1)
-- Rewards issue as 'earned' and become spendable Care Credit only after the
-- member claims them ('available'). Reservation/redemption state lives in an
-- immutable event ledger, never in reward status. Additive and idempotent.

-- 1. Re-assert the status constraint BEFORE changing the default (prod check
--    constraints have lagged app enums before — 028 in the repo already
--    permits 'earned', but this guarantees it wherever the migration runs).
--    Same value set as 028; rows outside it would surface as a real
--    discrepancy and must stop the migration.
alter table member_referral_rewards
  drop constraint if exists member_referral_rewards_status_check;
alter table member_referral_rewards
  add constraint member_referral_rewards_status_check
    check (status in ('earned', 'available', 'redeemed', 'expired'));

-- 2. New issuance default: earned (not yet spendable). Existing rows keep
--    their current status untouched.
alter table member_referral_rewards
  alter column status set default 'earned';

alter table member_referral_rewards
  add column if not exists claimed_at timestamptz;

comment on column member_referral_rewards.claimed_at is
  'When the member claimed the reward (earned -> available). Null until claimed.';

-- 3. Immutable reward event ledger. Text membership_id and billing_order_id
--    follow the referral domain''s loose-coupling convention (026/028).
create table if not exists member_referral_reward_events (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references member_referral_rewards(id) on delete restrict,
  membership_id text not null,
  event_type text not null
    check (event_type in ('claimed', 'reserved', 'released', 'redeemed', 'restored')),
  amount_cents integer not null check (amount_cents >= 0),
  billing_order_id text,
  actor_type text not null
    check (actor_type in ('member', 'hq', 'system')),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (nullif(trim(membership_id), '') is not null),
  check (nullif(trim(idempotency_key), '') is not null)
);

create index if not exists member_referral_reward_events_reward_idx
  on member_referral_reward_events(reward_id, created_at);

create index if not exists member_referral_reward_events_membership_idx
  on member_referral_reward_events(membership_id, created_at desc);

comment on table member_referral_reward_events is
  'Append-only Care Credit lifecycle ledger (claimed/reserved/released/redeemed/restored). Reservation truth lives here, never in reward status.';

create or replace function public.reject_member_referral_reward_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'member_referral_reward_events is append-only and immutable';
end;
$$;

drop trigger if exists member_referral_reward_events_immutable
  on member_referral_reward_events;
create trigger member_referral_reward_events_immutable
  before update or delete on member_referral_reward_events
  for each row execute function public.reject_member_referral_reward_event_change();

alter table member_referral_reward_events enable row level security;
-- No anon/authenticated policies. Claim writes go through the service-role
-- server path only; the portal reads its view through server routes.
