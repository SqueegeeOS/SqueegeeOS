-- Automatic first-of-service-month membership billing.
-- Global execution is installed OFF and must be armed by an HQ founder.

-- A non-null agreement id is not enough authority for an off-session charge.
-- New signatures persist the exact billing disclosure version and signed price.
-- Legacy agreements remain ineligible until Headquarters reviews the signed PDF
-- and records an explicit authorization attestation.
alter table public.signed_agreements
  add column if not exists billing_authorization_version text,
  add column if not exists billing_authorized_at timestamptz,
  add column if not exists authorized_visit_price_cents integer check (
    authorized_visit_price_cents is null or authorized_visit_price_cents > 0
  ),
  add column if not exists billing_terms_hash text;

alter table public.signed_agreements
  drop constraint if exists signed_agreements_billing_authorization_check,
  add constraint signed_agreements_billing_authorization_check check (
    (
      billing_authorization_version is null
      and billing_authorized_at is null
      and authorized_visit_price_cents is null
      and billing_terms_hash is null
    )
    or
    (
      nullif(trim(coalesce(billing_authorization_version, '')), '') is not null
      and billing_authorized_at is not null
      and authorized_visit_price_cents is not null
      and billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
    )
  );

create or replace function public.protect_signed_billing_authorization()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.billing_authorization_version is not null and (
    new.billing_authorization_version is distinct from old.billing_authorization_version
    or new.billing_authorized_at is distinct from old.billing_authorized_at
    or new.authorized_visit_price_cents is distinct from old.authorized_visit_price_cents
    or new.billing_terms_hash is distinct from old.billing_terms_hash
  ) then
    raise exception 'Signed billing authorization is immutable once recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists signed_agreements_billing_authorization_immutable
  on public.signed_agreements;
create trigger signed_agreements_billing_authorization_immutable
  before update on public.signed_agreements
  for each row execute function public.protect_signed_billing_authorization();

alter table public.memberships
  add column if not exists automatic_billing_enabled boolean not null default false,
  add column if not exists automatic_billing_paused_at timestamptz default now(),
  add column if not exists automatic_billing_pause_reason text
    default 'Requires verified signed automatic-billing authorization';

alter table public.memberships
  alter column automatic_billing_enabled set default false,
  alter column automatic_billing_paused_at set default now(),
  alter column automatic_billing_pause_reason set default
    'Requires verified signed automatic-billing authorization';

-- The authorization evidence is append-only and is part of the billing truth
-- boundary. Creating it before the legacy backfill makes this migration safe
-- both on its first run and if a partially applied draft is rerun later.
create table if not exists public.membership_billing_authorization_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  agreement_id uuid not null references public.signed_agreements(id) on delete restrict,
  authorization_version text not null,
  authorized_visit_price_cents integer not null,
  billing_terms_hash text not null,
  actor text not null,
  evidence_source text not null,
  occurred_at timestamptz not null default now()
);

alter table public.membership_billing_authorization_events
  drop constraint if exists membership_billing_authorization_events_price_check,
  add constraint membership_billing_authorization_events_price_check check (
    authorized_visit_price_cents > 0
  ),
  drop constraint if exists membership_billing_authorization_events_version_check,
  add constraint membership_billing_authorization_events_version_check check (
    authorization_version = 'membership-first-service-month-v1'
  ),
  drop constraint if exists membership_billing_authorization_events_hash_check,
  add constraint membership_billing_authorization_events_hash_check check (
    billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
  ),
  drop constraint if exists membership_billing_authorization_events_actor_check,
  add constraint membership_billing_authorization_events_actor_check check (
    nullif(trim(actor), '') is not null
  ),
  drop constraint if exists membership_billing_authorization_events_evidence_check,
  add constraint membership_billing_authorization_events_evidence_check check (
    evidence_source in ('customer_signature', 'founder_reviewed_signed_pdf')
  );

create index if not exists membership_billing_authorization_events_membership_idx
  on public.membership_billing_authorization_events (membership_id, occurred_at desc);

-- This exact column list is also the PostgREST/Supabase upsert conflict target.
-- It lets an interrupted customer-signature flow repair its missing audit row
-- without creating duplicate authorization evidence.
create unique index if not exists membership_billing_authorization_events_idempotency_unique
  on public.membership_billing_authorization_events (
    membership_id,
    agreement_id,
    authorization_version,
    evidence_source
  );

drop trigger if exists membership_billing_authorization_events_immutable
  on public.membership_billing_authorization_events;
create trigger membership_billing_authorization_events_immutable
  before update or delete on public.membership_billing_authorization_events
  for each row execute function public.reject_immutable_ledger_change();

-- Fail closed if an earlier draft of this migration was ever partially run.
-- A matching immutable evidence row is required, not merely mutable fields on
-- the membership or agreement. A rerun therefore preserves only authorizations
-- that were completed through the durable post-migration workflow.
update public.memberships membership
set automatic_billing_enabled = false,
    automatic_billing_paused_at = coalesce(
      membership.automatic_billing_paused_at,
      now()
    ),
    automatic_billing_pause_reason = coalesce(
      nullif(trim(membership.automatic_billing_pause_reason), ''),
      'Requires verified signed automatic-billing authorization'
    )
where not exists (
  select 1
  from public.signed_agreements agreement
  join public.membership_billing_authorization_events authorization_event
    on authorization_event.membership_id = membership.id
   and authorization_event.agreement_id = agreement.id
   and authorization_event.authorization_version = agreement.billing_authorization_version
   and authorization_event.authorized_visit_price_cents = agreement.authorized_visit_price_cents
   and authorization_event.billing_terms_hash = agreement.billing_terms_hash
   and authorization_event.occurred_at >= agreement.signed_at
   and authorization_event.occurred_at <= now() + interval '5 minutes'
  where agreement.id = membership.agreement_id
    and membership.status = 'active'
    and membership.billing_schedule = 'first_of_service_month'
    and agreement.status = 'complete'
    and agreement.membership_id = membership.id
    and agreement.property_id = membership.property_id
    and agreement.signed_at is not null
    and agreement.signed_at <= now() + interval '5 minutes'
    and nullif(trim(coalesce(agreement.agreement_pdf_url, '')), '') is not null
    and agreement.billing_authorization_version = 'membership-first-service-month-v1'
    and agreement.billing_authorized_at >= agreement.signed_at
    and agreement.billing_authorized_at <= now() + interval '5 minutes'
    and agreement.authorized_visit_price_cents = round(membership.visit_price * 100)::integer
    and agreement.billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
);

-- Normalize both sides of the kill-switch pair before adding its constraint.
-- This matters if a previously interrupted draft left otherwise valid evidence
-- with stale pause metadata.
update public.memberships
set automatic_billing_paused_at = null,
    automatic_billing_pause_reason = null
where automatic_billing_enabled = true;

update public.memberships
set automatic_billing_paused_at = coalesce(automatic_billing_paused_at, now()),
    automatic_billing_pause_reason = coalesce(
      nullif(trim(automatic_billing_pause_reason), ''),
      'Requires verified signed automatic-billing authorization'
    )
where automatic_billing_enabled = false;

alter table public.memberships
  drop constraint if exists memberships_automatic_billing_pause_check,
  add constraint memberships_automatic_billing_pause_check check (
    (automatic_billing_enabled = true
      and automatic_billing_paused_at is null
      and automatic_billing_pause_reason is null)
    or
    (automatic_billing_enabled = false
      and automatic_billing_paused_at is not null
      and nullif(trim(coalesce(automatic_billing_pause_reason, '')), '') is not null)
  );

alter table public.membership_billing_charges
  add column if not exists appointment_id uuid references public.member_appointments(id) on delete set null,
  add column if not exists scheduled_service_at timestamptz,
  add column if not exists authorized_amount_cents integer check (
    authorized_amount_cents is null or authorized_amount_cents >= 0
  ),
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists billing_authority_verified_at timestamptz,
  add column if not exists billing_authority_verified_by text;

update public.membership_billing_charges
set authorized_amount_cents = round(amount * 100)::integer
where authorized_amount_cents is null;

alter table public.membership_billing_charges
  drop constraint if exists membership_billing_charges_authority_pair_check,
  add constraint membership_billing_charges_authority_pair_check check (
    (billing_authority_verified_at is null and billing_authority_verified_by is null)
    or
    (billing_authority_verified_at is not null
      and nullif(trim(coalesce(billing_authority_verified_by, '')), '') is not null)
  ),
  drop constraint if exists membership_billing_charges_automatic_truth_check,
  add constraint membership_billing_charges_automatic_truth_check check (
    created_by is distinct from 'billing_automation'
    or (
      appointment_id is not null
      and scheduled_service_at is not null
      and authorized_amount_cents is not null
      and authorized_amount_cents > 0
      and attempt_count > 0
      and (
        status not in ('paid', 'charged')
        or (
          stripe_payment_intent_id is not null
          and billing_authority_verified_at is not null
          and nullif(trim(coalesce(billing_authority_verified_by, '')), '') is not null
        )
      )
    )
  );

create index if not exists membership_billing_charges_retry_idx
  on public.membership_billing_charges (status, next_retry_at)
  where status in ('pending', 'failed');

create unique index if not exists membership_billing_charges_stripe_intent_unique
  on public.membership_billing_charges (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- A linked property is not sufficient evidence that every Jobber job at the
-- address is a membership visit. Headquarters explicitly classifies the
-- recurring Jobber job once; every visit on that job can then be verified
-- against this durable mapping.
create table if not exists public.jobber_membership_job_links (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  external_job_id text not null,
  external_property_id text not null,
  membership_id uuid not null references public.memberships(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  link_state text not null default 'active' check (link_state in ('active', 'revoked')),
  linked_by text not null,
  link_reason text not null,
  linked_at timestamptz not null default now(),
  revoked_by text,
  revoke_reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_job_id),
  check (nullif(trim(external_job_id), '') is not null),
  check (nullif(trim(external_property_id), '') is not null),
  check (nullif(trim(linked_by), '') is not null),
  check (nullif(trim(link_reason), '') is not null),
  check (
    (link_state = 'active'
      and revoked_by is null
      and revoke_reason is null
      and revoked_at is null)
    or
    (link_state = 'revoked'
      and nullif(trim(coalesce(revoked_by, '')), '') is not null
      and nullif(trim(coalesce(revoke_reason, '')), '') is not null
      and revoked_at is not null)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobber_membership_job_links_membership_property_fkey'
  ) then
    alter table public.jobber_membership_job_links
      add constraint jobber_membership_job_links_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists jobber_membership_job_links_active_membership_job_unique
  on public.jobber_membership_job_links (membership_id, external_job_id)
  where link_state = 'active';

create index if not exists jobber_membership_job_links_membership_idx
  on public.jobber_membership_job_links (membership_id, link_state);

create or replace function public.validate_jobber_membership_job_link()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (
    new.connection_id is distinct from old.connection_id
    or new.external_job_id is distinct from old.external_job_id
    or new.external_property_id is distinct from old.external_property_id
  ) then
    raise exception 'Jobber job identity cannot be changed; revoke and relink instead';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.membership_id is distinct from old.membership_id
      or new.property_id is distinct from old.property_id
    )
    and not (old.link_state = 'revoked' and new.link_state = 'active')
  then
    raise exception 'An active Jobber membership job binding cannot be reassigned';
  end if;

  if tg_op = 'UPDATE'
    and not (old.link_state = 'revoked' and new.link_state = 'active')
    and (
      new.linked_by is distinct from old.linked_by
      or new.link_reason is distinct from old.link_reason
      or new.linked_at is distinct from old.linked_at
    )
  then
    raise exception 'Jobber membership job authorization metadata is immutable while linked';
  end if;

  if tg_op = 'UPDATE'
    and not (
      (old.link_state = 'active' and new.link_state = 'revoked')
      or (old.link_state = 'revoked' and new.link_state = 'active')
    )
    and (
      new.revoked_by is distinct from old.revoked_by
      or new.revoke_reason is distinct from old.revoke_reason
      or new.revoked_at is distinct from old.revoked_at
    )
  then
    raise exception 'Jobber membership job revocation metadata changes only with link state';
  end if;

  if new.link_state = 'active' and not exists (
    select 1
    from public.memberships membership
    join public.jobber_property_links property_link
      on property_link.connection_id = new.connection_id
     and property_link.external_property_id = new.external_property_id
     and property_link.membership_id = new.membership_id
     and property_link.property_id = new.property_id
     and property_link.link_state = 'active'
    where membership.id = new.membership_id
      and membership.property_id = new.property_id
      and membership.status = 'active'
  ) then
    raise exception 'Membership jobs require an active membership and verified Jobber property link';
  end if;
  if new.link_state = 'active' and not exists (
    select 1
    from public.jobber_visit_projections projection
    where projection.connection_id = new.connection_id
      and projection.external_job_id = new.external_job_id
      and projection.external_property_id = new.external_property_id
  ) then
    raise exception 'Membership job classification requires an observed Jobber visit';
  end if;
  return new;
end;
$$;

drop trigger if exists jobber_membership_job_links_validate
  on public.jobber_membership_job_links;
create trigger jobber_membership_job_links_validate
  before insert or update on public.jobber_membership_job_links
  for each row execute function public.validate_jobber_membership_job_link();

drop trigger if exists jobber_membership_job_links_updated_at
  on public.jobber_membership_job_links;
create trigger jobber_membership_job_links_updated_at
  before update on public.jobber_membership_job_links
  for each row execute function public.set_updated_at();

create table if not exists public.jobber_membership_job_link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.jobber_membership_job_links(id) on delete restrict,
  event_type text not null check (event_type in ('linked', 'relinked', 'revoked')),
  membership_id uuid not null,
  property_id uuid not null,
  external_job_id text not null,
  actor text not null,
  reason text not null,
  occurred_at timestamptz not null default now()
);

create or replace function public.audit_jobber_membership_job_link()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  next_event_type text;
  event_actor text;
  event_reason text;
begin
  if tg_op = 'INSERT' then
    next_event_type := 'linked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  elsif old.link_state = 'active' and new.link_state = 'revoked' then
    next_event_type := 'revoked';
    event_actor := new.revoked_by;
    event_reason := new.revoke_reason;
  elsif old.link_state = 'revoked' and new.link_state = 'active' then
    next_event_type := 'relinked';
    event_actor := new.linked_by;
    event_reason := new.link_reason;
  else
    return new;
  end if;

  insert into public.jobber_membership_job_link_events (
    link_id,
    event_type,
    membership_id,
    property_id,
    external_job_id,
    actor,
    reason
  ) values (
    new.id,
    next_event_type,
    new.membership_id,
    new.property_id,
    new.external_job_id,
    event_actor,
    event_reason
  );
  return new;
end;
$$;

drop trigger if exists jobber_membership_job_links_audit
  on public.jobber_membership_job_links;
create trigger jobber_membership_job_links_audit
  after insert or update on public.jobber_membership_job_links
  for each row execute function public.audit_jobber_membership_job_link();

drop trigger if exists jobber_membership_job_link_events_immutable
  on public.jobber_membership_job_link_events;
create trigger jobber_membership_job_link_events_immutable
  before update or delete on public.jobber_membership_job_link_events
  for each row execute function public.reject_immutable_ledger_change();

-- Unlock the preview ledger into an auditable execution state machine without
-- weakening its appointment and immutable-price truth trigger.
alter table public.billing_orders
  drop constraint if exists billing_orders_execution_state_check;

alter table public.billing_orders
  add constraint billing_orders_execution_state_check check (
    execution_state in (
      'disabled', 'pending', 'processing', 'succeeded', 'failed_retryable',
      'needs_action', 'permanently_failed', 'reconciliation_required', 'void'
    )
  ),
  add column if not exists due_at timestamptz,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists next_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists succeeded_at timestamptz;

-- Replace the preview-only approval prohibition with an all-or-nothing pair.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.billing_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%approved_by%is null%approved_at%is null%'
  loop
    execute format(
      'alter table public.billing_orders drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.billing_orders
  drop constraint if exists billing_orders_approval_pair_check,
  add constraint billing_orders_approval_pair_check check (
    (approved_by is null and approved_at is null)
    or
    (nullif(trim(coalesce(approved_by, '')), '') is not null and approved_at is not null)
  );

create unique index if not exists billing_orders_active_obligation_appointment_unique
  on public.billing_orders (obligation_id, appointment_id)
  where preview_state <> 'void' and execution_state <> 'void';

create unique index if not exists billing_orders_active_membership_month_unique
  on public.billing_orders (membership_id, service_month)
  where preview_state <> 'void' and execution_state <> 'void';

create unique index if not exists billing_orders_active_idempotency_key_unique
  on public.billing_orders (idempotency_key)
  where preview_state <> 'void' and execution_state <> 'void';

-- Keep the stronger legacy constraints in place until every replacement index
-- exists, so an interrupted non-transactional runner never weakens uniqueness.
alter table public.billing_orders
  drop constraint if exists billing_orders_obligation_id_appointment_id_key;

alter table public.billing_orders
  drop constraint if exists billing_orders_idempotency_key_key;

create unique index if not exists billing_orders_stripe_payment_intent_unique
  on public.billing_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists billing_orders_due_execution_idx
  on public.billing_orders (due_at, next_attempt_at)
  where preview_state = 'locked'
    and execution_state in ('pending', 'failed_retryable');

create or replace function public.validate_billing_order_truth()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  appointment_record public.member_appointments%rowtype;
  snapshot_record public.atlas_pricing_snapshots%rowtype;
  membership_record public.memberships%rowtype;
  agreement_record public.signed_agreements%rowtype;
  projection_record public.jobber_visit_projections%rowtype;
  effective_snapshot_amount integer;
begin
  if tg_op = 'UPDATE'
    and old.execution_state = 'succeeded'
    and new.execution_state <> 'succeeded'
  then
    raise exception 'A succeeded billing order cannot be downgraded';
  end if;
  if tg_op = 'UPDATE'
    and (old.preview_state = 'void' or old.execution_state = 'void')
    and not (new.preview_state = 'void' and new.execution_state = 'void')
  then
    raise exception 'A void billing order cannot be revived';
  end if;
  if tg_op = 'UPDATE'
    and (old.attempt_count > 0 or old.stripe_payment_intent_id is not null)
    and (
      new.membership_id is distinct from old.membership_id
      or new.property_id is distinct from old.property_id
      or new.obligation_id is distinct from old.obligation_id
      or new.appointment_id is distinct from old.appointment_id
      or new.pricing_snapshot_id is distinct from old.pricing_snapshot_id
      or new.service_month is distinct from old.service_month
      or new.scheduled_service_at is distinct from old.scheduled_service_at
      or new.amount_cents is distinct from old.amount_cents
      or new.credit_applied_cents is distinct from old.credit_applied_cents
      or new.expected_charge_cents is distinct from old.expected_charge_cents
      or new.idempotency_key is distinct from old.idempotency_key
    )
  then
    raise exception 'A Stripe-contacted billing order has immutable financial identity';
  end if;

  -- A stale pre-Stripe order may be made inert. Once Stripe was contacted it
  -- must reach a terminal or reconciliation state before anyone can void it.
  if new.preview_state = 'void' or new.execution_state = 'void' then
    if new.preview_state is distinct from 'void'
      or new.execution_state is distinct from 'void'
    then
      raise exception 'Billing order preview and execution must be voided together';
    end if;
    if tg_op = 'UPDATE'
      and (
        old.execution_state = 'processing'
        or old.stripe_payment_intent_id is not null
      )
    then
      raise exception 'A Stripe-contacted billing order must be reconciled before it can be voided';
    end if;
    return new;
  end if;

  -- Once Stripe has been contacted, recording its terminal result must remain
  -- possible even if Jobber changes a visit milliseconds later. The immutable
  -- billing identity and amount may not change during that transition.
  if tg_op = 'UPDATE'
    and old.execution_state in (
      'pending', 'processing', 'failed_retryable', 'needs_action', 'permanently_failed',
      'reconciliation_required'
    )
    and new.execution_state in (
      'succeeded', 'failed_retryable', 'needs_action', 'permanently_failed',
      'reconciliation_required'
    )
    and new.membership_id = old.membership_id
    and new.property_id = old.property_id
    and new.obligation_id = old.obligation_id
    and new.appointment_id = old.appointment_id
    and new.pricing_snapshot_id = old.pricing_snapshot_id
    and new.service_month = old.service_month
    and new.scheduled_service_at = old.scheduled_service_at
    and new.amount_cents = old.amount_cents
    and new.expected_charge_cents = old.expected_charge_cents
    and new.idempotency_key = old.idempotency_key
  then
    return new;
  end if;

  select * into appointment_record
  from public.member_appointments
  where id = new.appointment_id;

  if not found
    or lower(coalesce(appointment_record.provider, '')) <> 'jobber'
    or nullif(trim(coalesce(appointment_record.external_id, '')), '') is null
    or appointment_record.provenance_state is null
    or appointment_record.provenance_state not in ('provider_imported', 'manually_verified')
    or appointment_record.verification_state is distinct from 'verified'
    or appointment_record.match_state is distinct from 'matched'
    or appointment_record.status is distinct from 'scheduled'
    or appointment_record.matched_obligation_id is distinct from new.obligation_id
  then
    raise exception 'Billing order requires a verified, matched Jobber visit bound to this obligation';
  end if;

  if appointment_record.scheduled_at is distinct from new.scheduled_service_at then
    raise exception 'Billing order service time must equal the verified Jobber visit time';
  end if;

  if new.service_month <> date_trunc(
    'month',
    appointment_record.scheduled_at at time zone 'America/Los_Angeles'
  )::date then
    raise exception 'Billing order service month must match the Jobber visit date in America/Los_Angeles';
  end if;

  select * into membership_record
  from public.memberships
  where id = new.membership_id;

  select * into agreement_record
  from public.signed_agreements
  where id = membership_record.agreement_id;

  if membership_record.id is null
    or membership_record.status is distinct from 'active'
    or membership_record.automatic_billing_enabled is not true
    or membership_record.billing_schedule is distinct from 'first_of_service_month'
    or agreement_record.id is null
    or agreement_record.status is distinct from 'complete'
    or agreement_record.membership_id is distinct from membership_record.id
    or agreement_record.property_id is distinct from membership_record.property_id
    or agreement_record.signed_at is null
    or agreement_record.signed_at > now() + interval '5 minutes'
    or nullif(trim(coalesce(agreement_record.agreement_pdf_url, '')), '') is null
    or agreement_record.billing_authorization_version is distinct from 'membership-first-service-month-v1'
    or agreement_record.billing_authorized_at is null
    or agreement_record.billing_authorized_at < agreement_record.signed_at
    or agreement_record.billing_authorized_at > now() + interval '5 minutes'
    or agreement_record.authorized_visit_price_cents is distinct from round(membership_record.visit_price * 100)::integer
    or agreement_record.billing_terms_hash is distinct from '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
    or not exists (
      select 1
      from public.membership_billing_authorization_events authorization_event
      where authorization_event.membership_id = membership_record.id
        and authorization_event.agreement_id = agreement_record.id
        and authorization_event.authorization_version = agreement_record.billing_authorization_version
        and authorization_event.authorized_visit_price_cents = agreement_record.authorized_visit_price_cents
        and authorization_event.billing_terms_hash = agreement_record.billing_terms_hash
        and authorization_event.occurred_at >= agreement_record.signed_at
        and authorization_event.occurred_at <= now() + interval '5 minutes'
    )
  then
    raise exception 'Billing order requires a complete signed agreement bound to this membership, property, schedule, and price';
  end if;

  select * into projection_record
  from public.jobber_visit_projections
  where external_visit_id = appointment_record.external_id;

  if projection_record.id is null
    or projection_record.external_property_id is null
    or projection_record.scheduled_start is distinct from appointment_record.scheduled_at
    or projection_record.is_complete = true
    or projection_record.match_state is distinct from 'matched'
    or projection_record.matched_property_id is distinct from new.property_id
    or not exists (
      select 1
      from public.jobber_membership_job_links job_link
      join public.jobber_property_links property_link
        on property_link.connection_id = job_link.connection_id
       and property_link.external_property_id = job_link.external_property_id
       and property_link.membership_id = job_link.membership_id
       and property_link.property_id = job_link.property_id
       and property_link.link_state = 'active'
      where job_link.connection_id = projection_record.connection_id
        and job_link.external_job_id = projection_record.external_job_id
        and job_link.external_property_id = projection_record.external_property_id
        and job_link.membership_id = new.membership_id
        and job_link.property_id = new.property_id
        and job_link.link_state = 'active'
    )
  then
    raise exception 'Billing order requires a founder-classified Jobber membership job';
  end if;

  select * into snapshot_record
  from public.atlas_pricing_snapshots
  where id = new.pricing_snapshot_id;
  effective_snapshot_amount := coalesce(
    snapshot_record.override_amount_cents,
    snapshot_record.authorized_charge_cents
  );

  if snapshot_record.id is null
    or new.amount_cents is distinct from effective_snapshot_amount
    or new.amount_cents is distinct from agreement_record.authorized_visit_price_cents
  then
    raise exception 'Billing order amount must equal its immutable Atlas pricing snapshot';
  end if;

  if new.due_at is not null and (
    new.due_at at time zone 'America/Los_Angeles'
  )::date < new.service_month then
    raise exception 'Billing order cannot be due before its service month';
  end if;

  return new;
end;
$$;

create table if not exists public.billing_attempts (
  id uuid primary key default gen_random_uuid(),
  billing_order_id uuid not null references public.billing_orders(id) on delete restrict,
  attempt_number integer not null check (attempt_number >= 1),
  trigger_source text not null,
  stripe_payment_intent_id text,
  status text not null,
  failure_code text,
  failure_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (billing_order_id, attempt_number)
);

alter table public.billing_attempts
  drop constraint if exists billing_attempts_trigger_source_check,
  add constraint billing_attempts_trigger_source_check check (
    trigger_source in ('cron', 'founder_manual', 'founder_retry')
  ),
  drop constraint if exists billing_attempts_status_check,
  add constraint billing_attempts_status_check check (
    status in (
      'processing', 'succeeded', 'failed_retryable', 'needs_action',
      'permanently_failed', 'reconciliation_required'
    )
  );

create index if not exists billing_attempts_order_idx
  on public.billing_attempts (billing_order_id, attempt_number desc);

create or replace function public.attest_membership_billing_authorization(
  p_membership_id uuid,
  p_actor text,
  p_authorization_version text,
  p_billing_terms_hash text,
  p_now timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_record public.memberships%rowtype;
  agreement_record public.signed_agreements%rowtype;
  price_cents integer;
begin
  if nullif(trim(coalesce(p_actor, '')), '') is null then
    raise exception 'Authorization actor is required';
  end if;
  if p_authorization_version is distinct from 'membership-first-service-month-v1'
    or p_billing_terms_hash is distinct from '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
  then
    raise exception 'Authorization version or terms hash is invalid';
  end if;
  if p_now is null
    or p_now < now() - interval '5 minutes'
    or p_now > now() + interval '5 minutes'
  then
    raise exception 'Authorization time is invalid';
  end if;

  select * into membership_record
  from public.memberships
  where id = p_membership_id
  for update;
  if not found
    or membership_record.status is distinct from 'active'
    or membership_record.billing_schedule is distinct from 'first_of_service_month'
    or membership_record.agreement_id is null
    or membership_record.visit_price is null
    or membership_record.visit_price <= 0
  then
    raise exception 'Membership is not eligible for billing authorization review';
  end if;

  select * into agreement_record
  from public.signed_agreements
  where id = membership_record.agreement_id
  for update;
  if not found
    or agreement_record.status is distinct from 'complete'
    or agreement_record.membership_id is distinct from membership_record.id
    or agreement_record.property_id is distinct from membership_record.property_id
    or agreement_record.signed_at is null
    or nullif(trim(coalesce(agreement_record.agreement_pdf_url, '')), '') is null
    or p_now < agreement_record.signed_at
  then
    raise exception 'A complete, bound signed PDF is required';
  end if;

  price_cents := round(membership_record.visit_price * 100)::integer;
  if agreement_record.billing_authorization_version is null then
    update public.signed_agreements
    set billing_authorization_version = p_authorization_version,
        billing_authorized_at = p_now,
        authorized_visit_price_cents = price_cents,
        billing_terms_hash = p_billing_terms_hash
    where id = agreement_record.id;
  elsif agreement_record.billing_authorization_version is distinct from p_authorization_version
    or agreement_record.billing_authorized_at is null
    or agreement_record.billing_authorized_at < agreement_record.signed_at
    or agreement_record.billing_authorized_at > p_now + interval '5 minutes'
    or agreement_record.authorized_visit_price_cents is distinct from price_cents
    or agreement_record.billing_terms_hash is distinct from p_billing_terms_hash
  then
    raise exception 'Existing signed billing authorization cannot be rewritten';
  end if;

  insert into public.membership_billing_authorization_events (
    membership_id,
    agreement_id,
    authorization_version,
    authorized_visit_price_cents,
    billing_terms_hash,
    actor,
    evidence_source,
    occurred_at
  ) values (
    membership_record.id,
    agreement_record.id,
    p_authorization_version,
    price_cents,
    p_billing_terms_hash,
    p_actor,
    'founder_reviewed_signed_pdf',
    p_now
  ) on conflict (
    membership_id,
    agreement_id,
    authorization_version,
    evidence_source
  ) do nothing;

  if not exists (
    select 1
    from public.membership_billing_authorization_events authorization_event
    where authorization_event.membership_id = membership_record.id
      and authorization_event.agreement_id = agreement_record.id
      and authorization_event.authorization_version = p_authorization_version
      and authorization_event.authorized_visit_price_cents = price_cents
      and authorization_event.billing_terms_hash = p_billing_terms_hash
      and authorization_event.evidence_source = 'founder_reviewed_signed_pdf'
      and authorization_event.occurred_at >= agreement_record.signed_at
      and authorization_event.occurred_at <= p_now + interval '5 minutes'
  ) then
    raise exception 'Conflicting billing authorization evidence already exists';
  end if;

  update public.memberships
  set automatic_billing_enabled = false,
      automatic_billing_paused_at = coalesce(automatic_billing_paused_at, p_now),
      automatic_billing_pause_reason =
        'Authorization verified; founder must separately resume automatic billing'
  where id = membership_record.id;
end;
$$;

revoke all on function public.attest_membership_billing_authorization(
  uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.attest_membership_billing_authorization(
  uuid, text, text, text, timestamptz
) to service_role;

create table if not exists public.billing_automation_settings (
  id text primary key check (id = 'default'),
  enabled boolean not null default false,
  enabled_at timestamptz,
  enabled_by text,
  execution_mode text not null default 'shadow' check (
    execution_mode in ('shadow', 'approval', 'automatic')
  ),
  max_charge_cents integer not null default 100000 check (
    max_charge_cents > 0 and max_charge_cents <= 1000000
  ),
  stripe_webhook_verified_at timestamptz,
  stripe_webhook_secret_fingerprint text,
  last_run_at timestamptz,
  last_run_status text check (
    last_run_status is null or last_run_status in ('disabled', 'succeeded', 'partial', 'failed')
  ),
  last_run_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A partially configured or partially migrated switch is never considered
-- armed. Preserve only complete signed-webhook evidence.
update public.billing_automation_settings
set stripe_webhook_verified_at = null,
    stripe_webhook_secret_fingerprint = null
where stripe_webhook_verified_at is null
   or coalesce(stripe_webhook_secret_fingerprint, '') !~ '^[0-9a-f]{64}$';

update public.billing_automation_settings
set enabled = false,
    enabled_at = null,
    enabled_by = null,
    execution_mode = 'shadow'
where enabled = true
  and (
    execution_mode <> 'automatic'
    or enabled_at is null
    or nullif(trim(coalesce(enabled_by, '')), '') is null
    or stripe_webhook_verified_at is null
    or coalesce(stripe_webhook_secret_fingerprint, '') !~ '^[0-9a-f]{64}$'
  );

alter table public.billing_automation_settings
  drop constraint if exists billing_automation_settings_enabled_truth_check,
  add constraint billing_automation_settings_enabled_truth_check check (
    (enabled = false)
    or
    (enabled = true
      and enabled_at is not null
      and nullif(trim(coalesce(enabled_by, '')), '') is not null
      and execution_mode = 'automatic'
      and stripe_webhook_verified_at is not null
      and stripe_webhook_secret_fingerprint is not null
      and stripe_webhook_secret_fingerprint ~ '^[0-9a-f]{64}$')
  ),
  drop constraint if exists billing_automation_settings_webhook_pair_check,
  add constraint billing_automation_settings_webhook_pair_check check (
    (stripe_webhook_verified_at is null and stripe_webhook_secret_fingerprint is null)
    or
    (stripe_webhook_verified_at is not null
      and stripe_webhook_secret_fingerprint is not null
      and stripe_webhook_secret_fingerprint ~ '^[0-9a-f]{64}$')
  );

insert into public.billing_automation_settings (id, enabled)
values ('default', false)
on conflict (id) do nothing;

create table if not exists public.billing_automation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('cron', 'founder_manual', 'founder_retry')),
  actor text not null,
  service_month date not null check (
    service_month = date_trunc('month', service_month)::date
  ),
  status text not null check (status in ('running', 'succeeded', 'partial', 'failed', 'disabled')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  paid_count integer not null default 0 check (paid_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists billing_automation_runs_started_idx
  on public.billing_automation_runs (started_at desc);

alter table public.stripe_event_ledger
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempt_count integer not null default 0 check (
    processing_attempt_count >= 0
  );

create or replace function public.claim_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_api_version text,
  p_livemode boolean,
  p_object_id text,
  p_payload_hash text,
  p_now timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ledger_record public.stripe_event_ledger%rowtype;
begin
  if nullif(trim(coalesce(p_stripe_event_id, '')), '') is null
    or nullif(trim(coalesce(p_event_type, '')), '') is null
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_livemode is null
    or p_now is null
    or p_now < now() - interval '5 minutes'
    or p_now > now() + interval '5 minutes'
  then
    raise exception 'Stripe event claim identity is invalid';
  end if;

  insert into public.stripe_event_ledger (
    stripe_event_id,
    event_type,
    api_version,
    livemode,
    object_id,
    payload_hash
  ) values (
    p_stripe_event_id,
    p_event_type,
    p_api_version,
    p_livemode,
    p_object_id,
    p_payload_hash
  ) on conflict (stripe_event_id) do nothing;

  select * into ledger_record
  from public.stripe_event_ledger
  where stripe_event_id = p_stripe_event_id
  for update;

  if ledger_record.payload_hash is distinct from p_payload_hash
    or ledger_record.event_type is distinct from p_event_type
    or ledger_record.api_version is distinct from p_api_version
    or ledger_record.livemode is distinct from p_livemode
    or ledger_record.object_id is distinct from p_object_id
  then
    raise exception 'Stripe event identity conflict';
  end if;
  if ledger_record.processed_at is not null then
    return 'duplicate';
  end if;
  if ledger_record.processing_started_at is not null
    and ledger_record.processing_started_at > p_now - interval '5 minutes'
    and ledger_record.processing_error is null
  then
    return 'busy';
  end if;

  update public.stripe_event_ledger
  set processing_started_at = p_now,
      processing_attempt_count = processing_attempt_count + 1,
      processing_error = null
  where stripe_event_id = p_stripe_event_id;
  return 'claimed';
end;
$$;

revoke all on function public.claim_stripe_event(
  text, text, text, boolean, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(
  text, text, text, boolean, text, text, timestamptz
) to service_role;

create or replace function public.prepare_founder_billing_retry(
  p_order_id uuid,
  p_actor text,
  p_service_month date,
  p_now timestamptz default now()
)
returns public.billing_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.billing_orders%rowtype;
  previous_execution_state text;
begin
  if nullif(trim(coalesce(p_actor, '')), '') is null then
    raise exception 'Retry actor is required';
  end if;
  if p_now is null or p_service_month is null
    or p_now < now() - interval '5 minutes'
    or p_now > now() + interval '5 minutes'
  then
    raise exception 'Retry time and service month are required';
  end if;
  if p_service_month <> date_trunc('month', p_service_month)::date
    or p_service_month <> date_trunc(
      'month', p_now at time zone 'America/Los_Angeles'
    )::date
  then
    raise exception 'Founder retry is limited to the current service month';
  end if;
  if not exists (
    select 1
    from public.billing_automation_settings settings
    where settings.id = 'default'
      and settings.enabled = true
      and settings.execution_mode = 'automatic'
      and settings.enabled_at is not null
  ) then
    raise exception 'Automatic billing must be armed before preparing a retry';
  end if;

  select * into order_record
  from public.billing_orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Billing order not found';
  end if;
  if order_record.service_month <> p_service_month then
    raise exception 'Billing order does not belong to the requested service month';
  end if;
  if order_record.execution_state not in (
    'failed_retryable', 'needs_action', 'permanently_failed'
  ) then
    raise exception 'Billing order is not eligible for founder retry';
  end if;
  if order_record.execution_state = 'needs_action'
    and (
      lower(coalesce(order_record.failure_code, '')) in (
        'stripe_requires_action', 'requires_action', 'authentication_required'
      )
      or lower(coalesce(order_record.failure_message, '')) like '%requires_action%'
      or lower(coalesce(order_record.failure_message, '')) like '%authentication required%'
      or lower(coalesce(order_record.failure_message, '')) like '%authentication_required%'
    )
  then
    raise exception 'Customer authentication is required; founder retry is not allowed';
  end if;

  previous_execution_state := order_record.execution_state;
  update public.billing_orders
  set preview_state = 'locked',
      execution_state = 'pending',
      blocking_reasons = '[]'::jsonb,
      locked_at = p_now,
      approved_by = p_actor,
      approved_at = p_now,
      due_at = p_now,
      next_attempt_at = p_now,
      processing_started_at = null,
      lease_owner = null,
      lease_expires_at = null,
      failure_code = null,
      failure_message = null
  where id = p_order_id
  returning * into order_record;

  insert into public.billing_order_events (
    billing_order_id,
    event_type,
    actor,
    reason,
    event_data,
    occurred_at
  ) values (
    order_record.id,
    'locked',
    p_actor,
    'Founder explicitly approved retry for the current service month',
    jsonb_build_object(
      'previous_execution_state', previous_execution_state,
      'attempt_count', order_record.attempt_count,
      'service_month', order_record.service_month
    ),
    p_now
  );

  return order_record;
end;
$$;

revoke all on function public.prepare_founder_billing_retry(
  uuid, text, date, timestamptz
) from public, anon, authenticated;
grant execute on function public.prepare_founder_billing_retry(
  uuid, text, date, timestamptz
) to service_role;

-- Remove the pre-fingerprint draft signature so a partial rerun cannot leave an
-- executable overload that bypasses current webhook-secret verification.
drop function if exists public.claim_due_billing_orders(
  text, text, date, timestamptz, integer, uuid
);

create or replace function public.claim_due_billing_orders(
  p_lease_owner text,
  p_trigger_source text,
  p_service_month date,
  p_webhook_secret_fingerprint text,
  p_now timestamptz default now(),
  p_limit integer default 10,
  p_order_id uuid default null
)
returns setof public.billing_orders
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_lease_owner, '')), '') is null then
    raise exception 'Lease owner is required';
  end if;
  if p_trigger_source is null
    or p_trigger_source not in ('cron', 'founder_retry')
  then
    raise exception 'Only cron and explicit founder retry may claim a charge';
  end if;
  if p_order_id is not null and p_trigger_source <> 'founder_retry' then
    raise exception 'An exact-order claim requires founder_retry';
  end if;
  if p_trigger_source = 'founder_retry' and p_order_id is null then
    raise exception 'Founder retry requires one exact billing order';
  end if;
  if p_now is null then
    raise exception 'Claim time is required';
  end if;
  if p_now < now() - interval '5 minutes'
    or p_now > now() + interval '5 minutes'
  then
    raise exception 'Claim time is outside the accepted clock window';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'Claim limit must be between 1 and 25';
  end if;
  if p_service_month is null then
    raise exception 'Service month is required';
  end if;
  if coalesce(p_webhook_secret_fingerprint, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Current Stripe webhook fingerprint is required';
  end if;
  if p_service_month <> date_trunc('month', p_service_month)::date then
    raise exception 'Service month must be the first calendar day';
  end if;
  if p_service_month <> date_trunc(
    'month', p_now at time zone 'America/Los_Angeles'
  )::date then
    raise exception 'Automatic billing cannot charge a past or future service month';
  end if;

  return query
  with due as (
    select
      billing_order.id,
      billing_order.execution_state as previous_execution_state
    from public.billing_orders billing_order
    join public.billing_automation_settings settings
      on settings.id = 'default'
     and settings.enabled = true
     and settings.execution_mode = 'automatic'
     and settings.stripe_webhook_secret_fingerprint = p_webhook_secret_fingerprint
     and billing_order.expected_charge_cents <= settings.max_charge_cents
     and billing_order.approved_at >= settings.enabled_at
    join public.memberships membership
      on membership.id = billing_order.membership_id
     and membership.status = 'active'
     and membership.automatic_billing_enabled = true
     and membership.billing_schedule = 'first_of_service_month'
    join public.signed_agreements agreement
      on agreement.id = membership.agreement_id
     and agreement.status = 'complete'
     and agreement.membership_id = membership.id
     and agreement.property_id = membership.property_id
     and agreement.signed_at is not null
     and agreement.signed_at <= p_now + interval '5 minutes'
     and nullif(trim(coalesce(agreement.agreement_pdf_url, '')), '') is not null
     and agreement.billing_authorization_version = 'membership-first-service-month-v1'
     and agreement.billing_authorized_at >= agreement.signed_at
     and agreement.billing_authorized_at <= p_now + interval '5 minutes'
     and agreement.authorized_visit_price_cents = billing_order.expected_charge_cents
     and agreement.billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
    join public.member_appointments appointment
      on appointment.id = billing_order.appointment_id
     and appointment.property_id = billing_order.property_id
     and lower(appointment.provider) = 'jobber'
     and appointment.external_id is not null
     and appointment.status = 'scheduled'
     and appointment.provenance_state in ('provider_imported', 'manually_verified')
     and appointment.verification_state = 'verified'
     and appointment.match_state = 'matched'
     and appointment.matched_obligation_id = billing_order.obligation_id
     and appointment.scheduled_at = billing_order.scheduled_service_at
    join public.jobber_visit_projections projection
      on projection.external_visit_id = appointment.external_id
     and projection.scheduled_start = appointment.scheduled_at
     and projection.is_complete = false
     and projection.match_state = 'matched'
     and projection.matched_property_id = billing_order.property_id
    join public.jobber_membership_job_links job_link
      on job_link.connection_id = projection.connection_id
     and job_link.external_job_id = projection.external_job_id
     and job_link.external_property_id = projection.external_property_id
     and job_link.membership_id = billing_order.membership_id
     and job_link.property_id = billing_order.property_id
     and job_link.link_state = 'active'
    join public.jobber_property_links property_link
      on property_link.connection_id = job_link.connection_id
     and property_link.external_property_id = job_link.external_property_id
     and property_link.membership_id = job_link.membership_id
     and property_link.property_id = job_link.property_id
     and property_link.link_state = 'active'
    where billing_order.preview_state = 'locked'
      and billing_order.service_month = p_service_month
      and billing_order.amount_cents = billing_order.expected_charge_cents
      and billing_order.expected_charge_cents > 0
      and billing_order.stripe_customer_ready = true
      and billing_order.stripe_payment_method_ready = true
      and billing_order.due_at <= p_now
      and (billing_order.next_attempt_at is null or billing_order.next_attempt_at <= p_now)
      and (p_order_id is null or billing_order.id = p_order_id)
      and (
        billing_order.attempt_count < 3
        or p_trigger_source = 'founder_retry'
        or (
          billing_order.execution_state = 'processing'
          and billing_order.stripe_payment_intent_id is not null
          and billing_order.lease_expires_at <= p_now
        )
      )
      and (
        (
          billing_order.execution_state = 'pending'
          and (
            p_order_id is not null
            or (
              billing_order.attempt_count = 0
              and (p_now at time zone 'America/Los_Angeles')::date = p_service_month
            )
          )
        )
        or billing_order.execution_state = 'failed_retryable'
        or (
          billing_order.execution_state = 'processing'
          and billing_order.stripe_payment_intent_id is not null
          and billing_order.lease_expires_at <= p_now
        )
      )
      and (
        billing_order.lease_expires_at is null
        or billing_order.lease_expires_at <= p_now
      )
      and exists (
        select 1
        from public.membership_billing_authorization_events authorization_event
        where authorization_event.membership_id = membership.id
          and authorization_event.agreement_id = agreement.id
          and authorization_event.authorization_version = agreement.billing_authorization_version
          and authorization_event.authorized_visit_price_cents = agreement.authorized_visit_price_cents
          and authorization_event.billing_terms_hash = agreement.billing_terms_hash
          and authorization_event.occurred_at >= agreement.signed_at
          and authorization_event.occurred_at <= p_now + interval '5 minutes'
      )
    order by billing_order.due_at, billing_order.created_at
    for update of billing_order skip locked
    limit greatest(1, least(p_limit, 25))
  ),
  abandoned as (
    update public.billing_attempts attempt
    set status = 'failed_retryable',
        failure_code = 'processing_lease_expired',
        failure_message = 'The prior worker stopped before finalizing the Stripe result.',
        completed_at = p_now
    from due
    where due.previous_execution_state = 'processing'
      and attempt.billing_order_id = due.id
      and attempt.status = 'processing'
    returning attempt.billing_order_id
  ),
  claimed as (
    update public.billing_orders billing_order
    set execution_state = 'processing',
        attempt_count = billing_order.attempt_count + 1,
        processing_started_at = p_now,
        lease_owner = p_lease_owner,
        lease_expires_at = p_now + interval '10 minutes',
        failure_code = null,
        failure_message = null,
        updated_at = p_now
    from due
    where billing_order.id = due.id
      and (select count(*) from abandoned) >= 0
    returning billing_order.*
  ),
  attempts as (
    insert into public.billing_attempts (
      billing_order_id,
      attempt_number,
      trigger_source,
      stripe_payment_intent_id,
      status,
      started_at
    )
    select
      claimed.id,
      claimed.attempt_count,
      p_trigger_source,
      claimed.stripe_payment_intent_id,
      'processing',
      p_now
    from claimed
    returning billing_order_id
  )
  select claimed.*
  from claimed
  join attempts on attempts.billing_order_id = claimed.id;
end;
$$;

revoke all on function public.claim_due_billing_orders(
  text, text, date, text, timestamptz, integer, uuid
) from public, anon, authenticated;
grant execute on function public.claim_due_billing_orders(
  text, text, date, text, timestamptz, integer, uuid
) to service_role;

create or replace function public.finalize_billing_attempt_success(
  p_order_id uuid,
  p_attempt_number integer,
  p_intent_id text,
  p_stripe_reference text,
  p_completed_at timestamptz default now()
)
returns public.billing_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.billing_orders%rowtype;
  attempt_record public.billing_attempts%rowtype;
  membership_record public.memberships%rowtype;
  charge_record public.membership_billing_charges%rowtype;
  effective_intent_id text;
begin
  if p_attempt_number is null or p_attempt_number < 1 then
    raise exception 'A positive billing attempt number is required';
  end if;
  if p_completed_at is null then
    raise exception 'Billing completion time is required';
  end if;
  if p_completed_at < now() - interval '5 minutes'
    or p_completed_at > now() + interval '5 minutes'
  then
    raise exception 'Billing completion time is outside the accepted clock window';
  end if;
  if p_intent_id is not null
    and nullif(trim(p_intent_id), '') is null
  then
    raise exception 'PaymentIntent id cannot be blank';
  end if;

  select * into order_record
  from public.billing_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Billing order not found'; end if;
  if order_record.execution_state = 'void' then
    raise exception 'A void billing order cannot be completed';
  end if;
  if order_record.execution_state = 'succeeded' then
    if order_record.stripe_payment_intent_id is distinct from p_intent_id
    then
      raise exception 'Succeeded billing order is bound to another PaymentIntent';
    end if;
    return order_record;
  end if;
  if p_attempt_number <> order_record.attempt_count then
    raise exception 'Billing attempt is not current';
  end if;
  if order_record.execution_state not in (
    'pending', 'processing', 'failed_retryable', 'needs_action', 'permanently_failed',
    'reconciliation_required'
  ) then
    raise exception 'Billing order was not claimed for execution';
  end if;
  if order_record.stripe_payment_intent_id is not null
    and p_intent_id is not null
    and order_record.stripe_payment_intent_id <> p_intent_id
  then
    raise exception 'PaymentIntent does not match billing order';
  end if;
  effective_intent_id := coalesce(
    nullif(trim(coalesce(p_intent_id, '')), ''),
    nullif(trim(coalesce(order_record.stripe_payment_intent_id, '')), '')
  );

  select * into attempt_record
  from public.billing_attempts
  where billing_order_id = p_order_id
    and attempt_number = p_attempt_number
  for update;
  if not found then
    raise exception 'Billing attempt ledger row not found';
  end if;
  if attempt_record.started_at > p_completed_at + interval '5 minutes' then
    raise exception 'Billing completion cannot precede its attempt';
  end if;
  if attempt_record.status = 'succeeded'
    and attempt_record.stripe_payment_intent_id is distinct from effective_intent_id
  then
    raise exception 'Succeeded billing attempt is bound to another PaymentIntent';
  end if;

  select * into membership_record
  from public.memberships
  where id = order_record.membership_id;

  select * into charge_record
  from public.membership_billing_charges
  where membership_id = order_record.membership_id
    and service_month = order_record.service_month
  for update;

  if charge_record.id is not null then
    if round(charge_record.amount * 100)::integer <> order_record.expected_charge_cents then
      raise exception 'Existing billing ledger amount does not match the order';
    end if;
    if charge_record.authorized_amount_cents is not null
      and charge_record.authorized_amount_cents <> order_record.expected_charge_cents
    then
      raise exception 'Existing billing authorization amount does not match the order';
    end if;
    if charge_record.status in ('paid', 'charged') then
      if charge_record.billing_authority_verified_at is null
        or nullif(trim(coalesce(charge_record.billing_authority_verified_by, '')), '') is null
      then
        raise exception 'Historical paid ledger requires post-hardening founder verification';
      end if;
      if charge_record.stripe_payment_intent_id is null
        and effective_intent_id is not null
      then
        raise exception 'Existing manual paid ledger cannot be rebound to a PaymentIntent';
      end if;
      if charge_record.stripe_payment_intent_id is not null
        and charge_record.stripe_payment_intent_id is distinct from effective_intent_id
      then
        raise exception 'Existing paid ledger is bound to another PaymentIntent';
      end if;
    elsif effective_intent_id is null then
      raise exception 'A Stripe PaymentIntent is required to mark an unpaid ledger row paid';
    end if;
  end if;

  if charge_record.id is null then
    if effective_intent_id is null then
      raise exception 'A Stripe PaymentIntent is required for a new paid ledger row';
    end if;
    insert into public.membership_billing_charges (
      membership_id,
      homeowner_id,
      property_id,
      appointment_id,
      scheduled_service_at,
      service_month,
      visit_price,
      amount,
      amount_collected,
      authorized_amount_cents,
      status,
      charged_at,
      billing_method,
      stripe_reference,
      stripe_payment_intent_id,
      notes,
      created_by,
      attempt_count,
      last_attempt_at,
      billing_authority_verified_at,
      billing_authority_verified_by
    ) values (
      order_record.membership_id,
      membership_record.homeowner_id,
      order_record.property_id,
      order_record.appointment_id,
      order_record.scheduled_service_at,
      order_record.service_month,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents,
      'paid',
      p_completed_at,
      'automatic_stripe',
      coalesce(nullif(trim(coalesce(p_stripe_reference, '')), ''), effective_intent_id),
      effective_intent_id,
      'Automatic first-of-service-month membership billing',
      'billing_automation',
      p_attempt_number,
      p_completed_at,
      p_completed_at,
      'stripe_verified_billing_automation'
    );
  elsif charge_record.status not in ('paid', 'charged') then
    update public.membership_billing_charges
    set appointment_id = order_record.appointment_id,
        scheduled_service_at = order_record.scheduled_service_at,
        amount_collected = order_record.expected_charge_cents / 100.0,
        authorized_amount_cents = order_record.expected_charge_cents,
        status = 'paid',
        charged_at = p_completed_at,
        billing_method = 'automatic_stripe',
        stripe_reference = coalesce(
          nullif(trim(coalesce(p_stripe_reference, '')), ''),
          effective_intent_id
        ),
        stripe_payment_intent_id = effective_intent_id,
        attempt_count = p_attempt_number,
        last_attempt_at = p_completed_at,
        next_retry_at = null,
        failure_code = null,
        failure_message = null,
        billing_authority_verified_at = p_completed_at,
        billing_authority_verified_by = 'stripe_verified_billing_automation',
        notes = 'Automatic first-of-service-month membership billing'
    where id = charge_record.id;
  end if;

  update public.billing_attempts
  set status = 'succeeded',
      stripe_payment_intent_id = coalesce(effective_intent_id, stripe_payment_intent_id),
      completed_at = p_completed_at,
      failure_code = null,
      failure_message = null
  where billing_order_id = p_order_id
    and attempt_number = p_attempt_number
    and status <> 'succeeded';

  update public.billing_orders
  set execution_state = 'succeeded',
      stripe_payment_intent_id = coalesce(effective_intent_id, stripe_payment_intent_id),
      succeeded_at = p_completed_at,
      processing_started_at = null,
      lease_owner = null,
      lease_expires_at = null,
      next_attempt_at = null,
      failure_code = null,
      failure_message = null
  where id = p_order_id
  returning * into order_record;
  return order_record;
end;
$$;

create or replace function public.finalize_billing_attempt_failure(
  p_order_id uuid,
  p_attempt_number integer,
  p_outcome text,
  p_intent_id text,
  p_next_attempt_at timestamptz,
  p_failure_code text,
  p_failure_message text,
  p_completed_at timestamptz default now()
)
returns public.billing_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.billing_orders%rowtype;
  attempt_record public.billing_attempts%rowtype;
begin
  if p_attempt_number is null or p_attempt_number < 1 then
    raise exception 'A positive billing attempt number is required';
  end if;
  if p_completed_at is null then
    raise exception 'Billing completion time is required';
  end if;
  if p_completed_at < now() - interval '5 minutes'
    or p_completed_at > now() + interval '5 minutes'
  then
    raise exception 'Billing completion time is outside the accepted clock window';
  end if;
  if p_intent_id is not null
    and nullif(trim(p_intent_id), '') is null
  then
    raise exception 'PaymentIntent id cannot be blank';
  end if;
  if p_outcome is null or p_outcome not in (
    'failed_retryable', 'needs_action', 'permanently_failed',
    'reconciliation_required'
  ) then
    raise exception 'Invalid billing failure outcome';
  end if;
  if nullif(trim(coalesce(p_failure_code, '')), '') is null
    or nullif(trim(coalesce(p_failure_message, '')), '') is null
  then
    raise exception 'Billing failure code and message are required';
  end if;
  if p_outcome = 'failed_retryable' and (
    p_next_attempt_at is null or p_next_attempt_at <= p_completed_at
  ) then
    raise exception 'Retryable failures require a future retry time';
  end if;
  if p_outcome <> 'failed_retryable' and p_next_attempt_at is not null then
    raise exception 'Non-retryable outcomes cannot schedule a hidden retry';
  end if;

  select * into order_record
  from public.billing_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Billing order not found'; end if;
  if order_record.execution_state in ('succeeded', 'void') then
    return order_record;
  end if;
  if p_attempt_number <> order_record.attempt_count then
    return order_record;
  end if;
  if order_record.execution_state not in (
    'pending', 'processing', 'failed_retryable', 'needs_action', 'permanently_failed',
    'reconciliation_required'
  ) then
    raise exception 'Billing order was not claimed for execution';
  end if;
  if order_record.stripe_payment_intent_id is not null
    and p_intent_id is not null
    and order_record.stripe_payment_intent_id <> p_intent_id
  then
    raise exception 'PaymentIntent does not match billing order';
  end if;

  select * into attempt_record
  from public.billing_attempts
  where billing_order_id = p_order_id
    and attempt_number = p_attempt_number
  for update;
  if not found then
    raise exception 'Billing attempt ledger row not found';
  end if;
  if attempt_record.status = 'succeeded' then
    raise exception 'A succeeded billing attempt cannot be downgraded';
  end if;
  if attempt_record.started_at > p_completed_at + interval '5 minutes' then
    raise exception 'Billing completion cannot precede its attempt';
  end if;

  update public.billing_attempts
  set status = p_outcome,
      stripe_payment_intent_id = coalesce(p_intent_id, stripe_payment_intent_id),
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      completed_at = p_completed_at
  where billing_order_id = p_order_id
    and attempt_number = p_attempt_number
    and status <> 'succeeded';

  update public.membership_billing_charges
  set status = 'failed',
      amount_collected = 0,
      stripe_reference = coalesce(p_intent_id, stripe_reference),
      stripe_payment_intent_id = coalesce(p_intent_id, stripe_payment_intent_id),
      attempt_count = p_attempt_number,
      last_attempt_at = p_completed_at,
      next_retry_at = p_next_attempt_at,
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      notes = p_failure_message
  where p_outcome <> 'reconciliation_required'
    and membership_id = order_record.membership_id
    and service_month = order_record.service_month
    and status not in ('paid', 'charged');

  update public.billing_orders
  set execution_state = p_outcome,
      stripe_payment_intent_id = coalesce(p_intent_id, stripe_payment_intent_id),
      processing_started_at = null,
      lease_owner = null,
      lease_expires_at = null,
      next_attempt_at = p_next_attempt_at,
      failure_code = p_failure_code,
      failure_message = p_failure_message
  where id = p_order_id
  returning * into order_record;
  return order_record;
end;
$$;

revoke all on function public.finalize_billing_attempt_success(
  uuid, integer, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.finalize_billing_attempt_success(
  uuid, integer, text, text, timestamptz
) to service_role;
revoke all on function public.finalize_billing_attempt_failure(
  uuid, integer, text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.finalize_billing_attempt_failure(
  uuid, integer, text, text, timestamptz, text, text, timestamptz
) to service_role;

drop trigger if exists billing_automation_settings_updated_at
  on public.billing_automation_settings;
create trigger billing_automation_settings_updated_at
  before update on public.billing_automation_settings
  for each row execute function public.set_updated_at();

alter table public.billing_automation_settings enable row level security;
alter table public.billing_automation_runs enable row level security;
alter table public.billing_attempts enable row level security;
alter table public.membership_billing_authorization_events enable row level security;
alter table public.jobber_membership_job_links enable row level security;
alter table public.jobber_membership_job_link_events enable row level security;
alter table public.membership_billing_charges enable row level security;
alter table public.member_appointments enable row level security;
alter table public.obligations enable row level security;
alter table public.obligation_events enable row level security;
alter table public.atlas_pricing_snapshots enable row level security;
alter table public.appointment_source_events enable row level security;
alter table public.jobber_visit_projections enable row level security;
alter table public.jobber_property_links enable row level security;
drop policy if exists "membership_billing_charges_anon_all"
  on public.membership_billing_charges;

-- Earlier portal-era migrations granted anonymous FOR ALL access to
-- appointments and obligations. Those rows are now billing authority, so all
-- public policies on the complete source-of-truth chain must be removed before
-- automatic execution can exist.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'member_appointments',
        'obligations',
        'obligation_events',
        'atlas_pricing_snapshots',
        'appointment_source_events',
        'jobber_visit_projections',
        'jobber_property_links'
      ])
      and (
        'anon' = any(roles)
        or 'authenticated' = any(roles)
        or 'public' = any(roles)
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

revoke all privileges on table public.billing_automation_settings
  from public, anon, authenticated;
revoke all privileges on table public.billing_automation_runs
  from public, anon, authenticated;
revoke all privileges on table public.billing_attempts
  from public, anon, authenticated;
revoke all privileges on table public.membership_billing_authorization_events
  from public, anon, authenticated;
revoke all privileges on table public.jobber_membership_job_links
  from public, anon, authenticated;
revoke all privileges on table public.jobber_membership_job_link_events
  from public, anon, authenticated;
revoke all privileges on table public.membership_billing_charges
  from public, anon, authenticated;
revoke all privileges on table public.billing_orders
  from public, anon, authenticated;
revoke all privileges on table public.billing_order_events
  from public, anon, authenticated;
revoke all privileges on table public.stripe_event_ledger
  from public, anon, authenticated;
revoke all privileges on table public.payment_reconciliation_cases
  from public, anon, authenticated;
revoke all privileges on table public.member_appointments
  from public, anon, authenticated;
revoke all privileges on table public.obligations
  from public, anon, authenticated;
revoke all privileges on table public.obligation_events
  from public, anon, authenticated;
revoke all privileges on table public.atlas_pricing_snapshots
  from public, anon, authenticated;
revoke all privileges on table public.appointment_source_events
  from public, anon, authenticated;
revoke all privileges on table public.jobber_visit_projections
  from public, anon, authenticated;
revoke all privileges on table public.jobber_property_links
  from public, anon, authenticated;

grant select, insert, update on table public.billing_automation_settings
  to service_role;
grant select, insert, update on table public.billing_automation_runs
  to service_role;
grant select on table public.billing_attempts
  to service_role;
grant select, insert on table public.membership_billing_authorization_events
  to service_role;
grant select, insert, update on table public.jobber_membership_job_links
  to service_role;
grant select, insert on table public.jobber_membership_job_link_events
  to service_role;
grant select, insert, update on table public.membership_billing_charges
  to service_role;
grant select, insert, update on table public.billing_orders
  to service_role;
grant select, insert on table public.billing_order_events
  to service_role;
grant select, update on table public.stripe_event_ledger
  to service_role;
grant select, insert on table public.payment_reconciliation_cases
  to service_role;
grant select, insert, update, delete on table public.member_appointments
  to service_role;
grant select, insert, update, delete on table public.obligations
  to service_role;
grant select, insert on table public.obligation_events
  to service_role;
grant select, insert on table public.atlas_pricing_snapshots
  to service_role;
grant select, insert on table public.appointment_source_events
  to service_role;
grant select, insert, update on table public.jobber_visit_projections
  to service_role;
grant select, insert, update on table public.jobber_property_links
  to service_role;
-- No anon/authenticated policies or privileges. Billing control and audit data
-- are server/HQ only.

comment on column public.memberships.automatic_billing_enabled is
  'Per-membership kill switch. Global automatic billing must also be armed.';
comment on table public.billing_orders is
  'Auditable first-of-service-month billing plans; execution requires signed authorization, classified Jobber truth, founder approval, and both kill switches.';
comment on table public.membership_billing_charges is
  'Canonical manual and automatic membership charge ledger; one row per membership and service month.';
comment on table public.billing_automation_settings is
  'Singleton founder-controlled automatic billing switch. Migration defaults execution off.';
comment on table public.billing_automation_runs is
  'Audit log for cron and founder-triggered first-of-service-month billing runs.';
comment on table public.billing_attempts is
  'One durable row per Stripe attempt. Never marks field service complete.';
comment on table public.jobber_membership_job_links is
  'Founder-classified recurring Jobber jobs. Property pairing alone never grants billing authority.';
comment on table public.membership_billing_authorization_events is
  'Append-only evidence that the signed agreement version and signed visit price were verified.';
