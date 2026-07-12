-- Care Operations provider-neutral foundation.
-- Execution is intentionally absent: this migration creates ledgers and preview state only.

alter table public.member_appointments
  add column if not exists provider text,
  add column if not exists external_id text,
  add column if not exists provenance_state text not null default 'homeatlas_legacy_unverified',
  add column if not exists verification_state text not null default 'unverified',
  add column if not exists match_state text not null default 'manual_review',
  add column if not exists matched_obligation_id uuid references public.obligations(id) on delete set null,
  add column if not exists source_observed_at timestamptz,
  add column if not exists source_payload_hash text;

alter table public.member_appointments
  drop constraint if exists member_appointments_provenance_state_check,
  add constraint member_appointments_provenance_state_check check (
    provenance_state in ('homeatlas_legacy_unverified', 'provider_imported', 'manually_verified')
  ),
  drop constraint if exists member_appointments_verification_state_check,
  add constraint member_appointments_verification_state_check check (
    verification_state in ('unverified', 'pending_review', 'verified', 'rejected')
  ),
  drop constraint if exists member_appointments_match_state_check,
  add constraint member_appointments_match_state_check check (
    match_state in ('manual_review', 'unmatched', 'matched', 'ignored')
  ),
  drop constraint if exists member_appointments_verified_provider_identity_check,
  add constraint member_appointments_verified_provider_identity_check check (
    verification_state <> 'verified' or (provider is not null and external_id is not null)
  );

-- Existing rows retain the founder-approved legacy classification. This statement
-- is deliberately one-way and never promotes a record.
update public.member_appointments
set provenance_state = 'homeatlas_legacy_unverified',
    verification_state = 'unverified',
    match_state = 'manual_review',
    provider = null,
    external_id = null
where provider is null or external_id is null;

create unique index if not exists member_appointments_provider_external_id_unique
  on public.member_appointments(provider, external_id)
  where provider is not null and external_id is not null;

create index if not exists member_appointments_manual_review_idx
  on public.member_appointments(match_state, verification_state);

create table if not exists public.appointment_source_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.member_appointments(id) on delete restrict,
  provider text,
  external_id text,
  event_type text not null check (event_type in (
    'legacy_classified', 'provider_observed', 'source_changed', 'match_changed',
    'verification_requested', 'verification_approved', 'verification_rejected'
  )),
  actor text not null,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Preserve the audit trail even if this migration is re-run after an earlier
-- draft created the relationship with cascading deletes.
alter table public.appointment_source_events
  drop constraint if exists appointment_source_events_appointment_id_fkey,
  add constraint appointment_source_events_appointment_id_fkey
    foreign key (appointment_id)
    references public.member_appointments(id)
    on delete restrict;

create index if not exists appointment_source_events_appointment_idx
  on public.appointment_source_events(appointment_id, occurred_at);

insert into public.appointment_source_events (
  appointment_id, event_type, actor, reason, evidence
)
select id, 'legacy_classified', 'migration_031',
  'Founder-approved classification: existing HomeAtlas appointment is not scheduling truth',
  jsonb_build_object('provenance_state', provenance_state, 'verification_state', verification_state)
from public.member_appointments
where not exists (
  select 1
  from public.appointment_source_events existing
  where existing.appointment_id = member_appointments.id
    and existing.event_type = 'legacy_classified'
    and existing.actor = 'migration_031'
);

create table if not exists public.atlas_pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  engine_version text not null,
  company_settings_version text not null,
  company_settings_hash text not null,
  normalized_inputs jsonb not null,
  line_item_output jsonb not null,
  authorized_charge_cents integer not null check (authorized_charge_cents >= 0),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  obligation_id uuid not null references public.obligations(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  override_amount_cents integer check (override_amount_cents is null or override_amount_cents >= 0),
  override_approver text,
  override_reason text,
  created_at timestamptz not null default now(),
  check (
    (override_amount_cents is null and override_approver is null and override_reason is null)
    or
    (override_amount_cents is not null and override_approver is not null and override_reason is not null)
  )
);

create index if not exists atlas_pricing_snapshots_obligation_idx
  on public.atlas_pricing_snapshots(obligation_id, created_at);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  obligation_id uuid not null references public.obligations(id) on delete restrict,
  appointment_id uuid not null references public.member_appointments(id) on delete restrict,
  pricing_snapshot_id uuid not null references public.atlas_pricing_snapshots(id) on delete restrict,
  service_month date not null check (service_month = date_trunc('month', service_month)::date),
  scheduled_service_at timestamptz not null,
  amount_cents integer not null check (amount_cents >= 0),
  credit_applied_cents integer not null default 0 check (credit_applied_cents >= 0),
  expected_charge_cents integer not null check (expected_charge_cents >= 0),
  stripe_customer_ready boolean not null default false,
  stripe_payment_method_ready boolean not null default false,
  preview_state text not null default 'draft' check (
    preview_state in ('draft', 'blocked', 'ready', 'locked', 'void')
  ),
  execution_state text not null default 'disabled' check (execution_state = 'disabled'),
  blocking_reasons jsonb not null default '[]'::jsonb,
  input_fingerprint text not null,
  idempotency_key text not null unique,
  locked_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obligation_id, appointment_id),
  check (credit_applied_cents <= amount_cents),
  check (expected_charge_cents = amount_cents - credit_applied_cents),
  check (approved_by is null and approved_at is null),
  check (locked_at is null or preview_state = 'locked')
);

-- An earlier preview-only draft did not carry property_id on the order. Preserve
-- rerun safety without guessing: the linked appointment is the only permitted
-- source for the backfill, and an unresolved row aborts the migration.
alter table public.billing_orders
  add column if not exists property_id uuid references public.properties(id) on delete restrict;

update public.billing_orders billing_order
set property_id = appointment.property_id
from public.member_appointments appointment
where billing_order.property_id is null
  and appointment.id = billing_order.appointment_id;

do $$
begin
  if exists (select 1 from public.billing_orders where property_id is null) then
    raise exception 'Cannot bind billing order: property could not be derived from its appointment';
  end if;
end;
$$;

alter table public.billing_orders alter column property_id set not null;

-- Composite uniqueness exists only to support relational truth constraints.
-- It makes it impossible for individually valid IDs from different homes or
-- memberships to be assembled into one billing candidate.
create unique index if not exists memberships_id_property_unique
  on public.memberships(id, property_id);
create unique index if not exists obligations_id_membership_property_unique
  on public.obligations(id, membership_id, property_id);
create unique index if not exists obligations_id_property_unique
  on public.obligations(id, property_id);
create unique index if not exists member_appointments_id_property_obligation_unique
  on public.member_appointments(id, property_id, matched_obligation_id);
create unique index if not exists atlas_pricing_snapshots_id_binding_unique
  on public.atlas_pricing_snapshots(id, membership_id, obligation_id, property_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_order_membership_property_fkey') then
    alter table public.billing_orders add constraint billing_order_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pricing_snapshot_obligation_binding_fkey') then
    alter table public.atlas_pricing_snapshots add constraint pricing_snapshot_obligation_binding_fkey
      foreign key (obligation_id, membership_id, property_id)
      references public.obligations(id, membership_id, property_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pricing_snapshot_membership_property_fkey') then
    alter table public.atlas_pricing_snapshots add constraint pricing_snapshot_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'billing_order_obligation_binding_fkey') then
    alter table public.billing_orders add constraint billing_order_obligation_binding_fkey
      foreign key (obligation_id, membership_id, property_id)
      references public.obligations(id, membership_id, property_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'billing_order_appointment_binding_fkey') then
    alter table public.billing_orders add constraint billing_order_appointment_binding_fkey
      foreign key (appointment_id, property_id, obligation_id)
      references public.member_appointments(id, property_id, matched_obligation_id)
      on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'billing_order_snapshot_binding_fkey') then
    alter table public.billing_orders add constraint billing_order_snapshot_binding_fkey
      foreign key (pricing_snapshot_id, membership_id, obligation_id, property_id)
      references public.atlas_pricing_snapshots(id, membership_id, obligation_id, property_id)
      on delete restrict;
  end if;
end;
$$;

create or replace function public.validate_billing_order_truth()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  appointment_record public.member_appointments%rowtype;
  snapshot_record public.atlas_pricing_snapshots%rowtype;
  effective_snapshot_amount integer;
begin
  select * into appointment_record
  from public.member_appointments
  where id = new.appointment_id;

  if not found
    or lower(coalesce(appointment_record.provider, '')) <> 'jobber'
    or nullif(trim(coalesce(appointment_record.external_id, '')), '') is null
    or appointment_record.provenance_state not in ('provider_imported', 'manually_verified')
    or appointment_record.verification_state <> 'verified'
    or appointment_record.match_state <> 'matched'
  then
    raise exception 'Billing order requires a verified, matched Jobber visit';
  end if;

  if appointment_record.scheduled_at <> new.scheduled_service_at then
    raise exception 'Billing order service time must equal the verified Jobber visit time';
  end if;

  if new.service_month <> date_trunc(
    'month',
    appointment_record.scheduled_at at time zone 'America/Los_Angeles'
  )::date then
    raise exception 'Billing order service month must match the Jobber visit date in America/Los_Angeles';
  end if;

  select * into snapshot_record
  from public.atlas_pricing_snapshots
  where id = new.pricing_snapshot_id;
  effective_snapshot_amount := coalesce(
    snapshot_record.override_amount_cents,
    snapshot_record.authorized_charge_cents
  );

  if snapshot_record.id is null or new.amount_cents <> effective_snapshot_amount then
    raise exception 'Billing order amount must equal its immutable Atlas pricing snapshot';
  end if;

  return new;
end;
$$;

drop trigger if exists billing_orders_validate_truth on public.billing_orders;
create trigger billing_orders_validate_truth
  before insert or update on public.billing_orders
  for each row execute function public.validate_billing_order_truth();

-- Triggers protect future writes. Refuse to bless pre-existing draft rows that
-- do not already satisfy the same truth boundary.
do $$
begin
  if exists (
    select 1
    from public.billing_orders billing_order
    join public.member_appointments appointment on appointment.id = billing_order.appointment_id
    join public.atlas_pricing_snapshots snapshot on snapshot.id = billing_order.pricing_snapshot_id
    where lower(coalesce(appointment.provider, '')) <> 'jobber'
      or nullif(trim(coalesce(appointment.external_id, '')), '') is null
      or appointment.provenance_state not in ('provider_imported', 'manually_verified')
      or appointment.verification_state <> 'verified'
      or appointment.match_state <> 'matched'
      or appointment.scheduled_at <> billing_order.scheduled_service_at
      or billing_order.service_month <> date_trunc(
        'month', appointment.scheduled_at at time zone 'America/Los_Angeles'
      )::date
      or billing_order.amount_cents <> coalesce(
        snapshot.override_amount_cents, snapshot.authorized_charge_cents
      )
  ) then
    raise exception 'Existing billing order violates the Care Operations truth boundary';
  end if;
end;
$$;

create index if not exists billing_orders_service_month_idx
  on public.billing_orders(service_month, preview_state);

create table if not exists public.billing_order_events (
  id uuid primary key default gen_random_uuid(),
  billing_order_id uuid not null references public.billing_orders(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'previewed', 'blocked', 'ready', 'locked', 'inputs_changed', 'voided'
  )),
  actor text not null,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists billing_order_events_order_idx
  on public.billing_order_events(billing_order_id, occurred_at);

create table if not exists public.stripe_event_ledger (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  api_version text,
  livemode boolean not null,
  object_id text,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create table if not exists public.payment_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  billing_order_id uuid references public.billing_orders(id) on delete restrict,
  stripe_object_id text,
  discrepancy_type text not null check (discrepancy_type in (
    'stripe_paid_local_missing', 'local_paid_stripe_missing', 'amount_mismatch',
    'status_mismatch', 'duplicate_candidate'
  )),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  evidence jsonb not null default '{}'::jsonb,
  resolution text,
  resolved_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists payment_reconciliation_open_unique
  on public.payment_reconciliation_cases(discrepancy_type, coalesce(billing_order_id::text, ''), coalesce(stripe_object_id, ''))
  where status <> 'resolved';

create or replace function public.reject_immutable_ledger_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  raise exception '% is append-only and immutable', tg_table_name;
end;
$$;

drop trigger if exists atlas_pricing_snapshots_immutable on public.atlas_pricing_snapshots;
create trigger atlas_pricing_snapshots_immutable before update or delete on public.atlas_pricing_snapshots
  for each row execute function public.reject_immutable_ledger_change();
drop trigger if exists appointment_source_events_immutable on public.appointment_source_events;
create trigger appointment_source_events_immutable before update or delete on public.appointment_source_events
  for each row execute function public.reject_immutable_ledger_change();
drop trigger if exists billing_order_events_immutable on public.billing_order_events;
create trigger billing_order_events_immutable before update or delete on public.billing_order_events
  for each row execute function public.reject_immutable_ledger_change();
drop trigger if exists stripe_event_ledger_no_delete on public.stripe_event_ledger;
create trigger stripe_event_ledger_no_delete before delete on public.stripe_event_ledger
  for each row execute function public.reject_immutable_ledger_change();

drop trigger if exists billing_orders_updated_at on public.billing_orders;
create trigger billing_orders_updated_at before update on public.billing_orders
  for each row execute function public.set_updated_at();

alter table public.appointment_source_events enable row level security;
alter table public.atlas_pricing_snapshots enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_order_events enable row level security;
alter table public.stripe_event_ledger enable row level security;
alter table public.payment_reconciliation_cases enable row level security;
-- No anon policies. Care Operations ledgers are server/service-role only.

comment on column public.member_appointments.provenance_state is
  'All pre-031 rows are homeatlas_legacy_unverified; only verified provider identity may be authoritative';
comment on table public.billing_orders is
  'Preview-only billing plans. Database constraint permanently disables execution in this release';
