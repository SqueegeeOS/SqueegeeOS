-- Migration 046: standing authorization for all priced Jobber services.
-- Installed fail-closed: every existing member is paused until a new v2
-- authorization is signed, and the global billing switch remains unchanged.

alter table public.jobber_visit_projections
  add column if not exists client_confirmed boolean not null default false,
  add column if not exists is_last_scheduled_visit boolean not null default false,
  add column if not exists job_type text,
  add column if not exists job_billing_type text,
  add column if not exists job_total_cents integer check (
    job_total_cents is null or job_total_cents >= 0
  ),
  add column if not exists job_will_auto_charge boolean not null default false,
  add column if not exists visit_invoice_id text,
  add column if not exists visit_invoice_status text;

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
      billing_authorization_version = 'membership-first-service-month-v1'
      and billing_authorized_at is not null
      and authorized_visit_price_cents > 0
      and billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b'
    )
    or
    (
      billing_authorization_version = 'membership-jobber-scheduled-services-v2'
      and billing_authorized_at is not null
      and authorized_visit_price_cents > 0
      and billing_terms_hash = 'ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd'
    )
  );

alter table public.membership_billing_authorization_events
  drop constraint if exists membership_billing_authorization_events_version_check,
  add constraint membership_billing_authorization_events_version_check check (
    authorization_version in (
      'membership-first-service-month-v1',
      'membership-jobber-scheduled-services-v2'
    )
  ),
  drop constraint if exists membership_billing_authorization_events_hash_check,
  add constraint membership_billing_authorization_events_hash_check check (
    (authorization_version = 'membership-first-service-month-v1'
      and billing_terms_hash = '282bdc404a21df6c3600b13821e67faa3c1e17b46d8368bf3979a4fc08cec28b')
    or
    (authorization_version = 'membership-jobber-scheduled-services-v2'
      and billing_terms_hash = 'ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd')
  );

-- A v1 agreement authorizes only the signed membership visit price. It cannot
-- silently become authority for arbitrary Jobber add-ons. Pause every member
-- that does not have the new customer-signed standing authorization.
update public.memberships membership
set automatic_billing_enabled = false,
    automatic_billing_paused_at = coalesce(automatic_billing_paused_at, now()),
    automatic_billing_pause_reason =
      'Requires signed Jobber scheduled-services billing authorization'
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
    and agreement.status = 'complete'
    and agreement.membership_id = membership.id
    and agreement.property_id = membership.property_id
    and agreement.billing_authorization_version = 'membership-jobber-scheduled-services-v2'
    and agreement.billing_terms_hash = 'ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd'
);

-- v2 prices are sourced from a verified Jobber visit, not from an obligation.
alter table public.billing_orders
  drop constraint if exists billing_order_obligation_binding_fkey,
  drop constraint if exists billing_order_appointment_binding_fkey,
  drop constraint if exists billing_order_snapshot_binding_fkey;
alter table public.atlas_pricing_snapshots
  drop constraint if exists pricing_snapshot_obligation_binding_fkey;

alter table public.billing_orders alter column obligation_id drop not null;
alter table public.atlas_pricing_snapshots alter column obligation_id drop not null;

create unique index if not exists member_appointments_id_property_unique
  on public.member_appointments(id, property_id);
create unique index if not exists atlas_pricing_snapshots_id_membership_property_unique
  on public.atlas_pricing_snapshots(id, membership_id, property_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_order_appointment_property_fkey'
  ) then
    alter table public.billing_orders
      add constraint billing_order_appointment_property_fkey
      foreign key (appointment_id, property_id)
      references public.member_appointments(id, property_id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_order_snapshot_membership_property_fkey'
  ) then
    alter table public.billing_orders
      add constraint billing_order_snapshot_membership_property_fkey
      foreign key (pricing_snapshot_id, membership_id, property_id)
      references public.atlas_pricing_snapshots(id, membership_id, property_id)
      on delete restrict;
  end if;
end;
$$;

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
  if p_trigger_source is null or p_trigger_source not in ('cron', 'founder_retry') then
    raise exception 'Only cron and explicit founder retry may claim a charge';
  end if;
  if p_order_id is not null and p_trigger_source <> 'founder_retry' then
    raise exception 'An exact-order claim requires founder_retry';
  end if;
  if p_trigger_source = 'founder_retry' and p_order_id is null then
    raise exception 'Founder retry requires one exact billing order';
  end if;
  if p_now is null
    or p_now < now() - interval '5 minutes'
    or p_now > now() + interval '5 minutes'
  then
    raise exception 'Claim time is outside the accepted clock window';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'Claim limit must be between 1 and 25';
  end if;
  if p_service_month is null
    or p_service_month <> date_trunc('month', p_service_month)::date
  then
    raise exception 'Service month must be the first calendar day';
  end if;
  if coalesce(p_webhook_secret_fingerprint, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Current Stripe webhook fingerprint is required';
  end if;
  if p_service_month <> date_trunc(
    'month', p_now at time zone 'America/Los_Angeles'
  )::date then
    raise exception 'Automatic billing cannot charge a past or future service month';
  end if;

  return query
  with due as (
    select billing_order.id,
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
     and membership.property_id = billing_order.property_id
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
     and agreement.billing_authorization_version = 'membership-jobber-scheduled-services-v2'
     and agreement.billing_authorized_at >= agreement.signed_at
     and agreement.billing_authorized_at <= p_now + interval '5 minutes'
     and agreement.authorized_visit_price_cents = round(membership.visit_price * 100)::integer
     and agreement.billing_terms_hash = 'ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd'
    join public.member_appointments appointment
      on appointment.id = billing_order.appointment_id
     and appointment.property_id = billing_order.property_id
     and lower(appointment.provider) = 'jobber'
     and appointment.external_id is not null
     and appointment.status = 'scheduled'
     and appointment.provenance_state in ('provider_imported', 'manually_verified')
     and appointment.verification_state = 'verified'
     and appointment.match_state = 'matched'
     and appointment.scheduled_at = billing_order.scheduled_service_at
    join public.jobber_visit_projections projection
      on projection.connection_id = 'squeegeeking'
     and projection.external_visit_id = appointment.external_id
     and projection.scheduled_start = appointment.scheduled_at
     and projection.is_complete = false
     and projection.match_state = 'matched'
     and projection.matched_property_id = billing_order.property_id
     and projection.job_total_cents = billing_order.expected_charge_cents
     and projection.job_total_cents > 0
     and projection.job_will_auto_charge = false
     and projection.visit_invoice_id is null
    join public.jobber_property_links property_link
      on property_link.connection_id = projection.connection_id
     and property_link.external_property_id = projection.external_property_id
     and property_link.membership_id = billing_order.membership_id
     and property_link.property_id = billing_order.property_id
     and property_link.link_state = 'active'
    join public.atlas_pricing_snapshots snapshot
      on snapshot.id = billing_order.pricing_snapshot_id
     and snapshot.membership_id = billing_order.membership_id
     and snapshot.property_id = billing_order.property_id
     and snapshot.obligation_id is null
     and snapshot.engine_version = 'jobber-scheduled-services-v2'
     and snapshot.company_settings_hash = billing_order.input_fingerprint
     and snapshot.normalized_inputs ->> 'external_job_id' = projection.external_job_id
     and snapshot.normalized_inputs ->> 'external_visit_id' = projection.external_visit_id
     and snapshot.normalized_inputs ->> 'jobber_source_payload_hash' = projection.source_payload_hash
     and coalesce((snapshot.normalized_inputs ->> 'job_total_cents')::integer, -1) = projection.job_total_cents
     and coalesce(snapshot.override_amount_cents, snapshot.authorized_charge_cents) = projection.job_total_cents
    where billing_order.preview_state = 'locked'
      and billing_order.obligation_id is null
      and billing_order.service_month = p_service_month
      and billing_order.amount_cents = billing_order.expected_charge_cents
      and billing_order.expected_charge_cents > 0
      and billing_order.stripe_customer_ready = true
      and billing_order.stripe_payment_method_ready = true
      and billing_order.due_at <= p_now
      and (billing_order.next_attempt_at is null or billing_order.next_attempt_at <= p_now)
      and (p_order_id is null or billing_order.id = p_order_id)
      and (
        (
          regexp_replace(lower(coalesce(projection.job_type, '')), '[^a-z0-9]+', '_', 'g') like '%one%'
          and regexp_replace(lower(coalesce(projection.job_type, '')), '[^a-z0-9]+', '_', 'g') like '%off%'
          and projection.is_last_scheduled_visit = true
          and snapshot.normalized_inputs ->> 'charge_kind' = 'one_off_job'
        )
        or (
          regexp_replace(lower(coalesce(projection.job_billing_type, '')), '[^a-z0-9]+', '_', 'g') like '%visit%'
          and snapshot.normalized_inputs ->> 'charge_kind' = 'recurring_per_visit'
        )
        or (
          regexp_replace(lower(coalesce(projection.job_billing_type, '')), '[^a-z0-9]+', '_', 'g') like '%fixed%'
          and snapshot.normalized_inputs ->> 'charge_kind' = 'recurring_fixed_price'
          and not exists (
            select 1
            from public.jobber_visit_projections earlier
            where earlier.connection_id = projection.connection_id
              and earlier.external_job_id = projection.external_job_id
              and earlier.external_visit_id <> projection.external_visit_id
              and earlier.scheduled_start < projection.scheduled_start
              and date_trunc('month', earlier.scheduled_start at time zone 'America/Los_Angeles')::date = p_service_month
          )
        )
      )
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
      and (billing_order.lease_expires_at is null or billing_order.lease_expires_at <= p_now)
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
      billing_order_id, attempt_number, trigger_source,
      stripe_payment_intent_id, status, started_at
    )
    select claimed.id, claimed.attempt_count, p_trigger_source,
           claimed.stripe_payment_intent_id, 'processing', p_now
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


drop index if exists public.billing_orders_active_obligation_appointment_unique;
drop index if exists public.billing_orders_active_membership_month_unique;
create unique index if not exists billing_orders_active_appointment_unique
  on public.billing_orders (appointment_id)
  where preview_state <> 'void' and execution_state <> 'void';

alter table public.membership_billing_charges
  drop constraint if exists membership_billing_charges_membership_id_service_month_key;
create unique index if not exists membership_billing_charges_automatic_appointment_unique
  on public.membership_billing_charges (membership_id, appointment_id)
  where appointment_id is not null;

-- Retire any untouched v1 previews. Provider-contacted rows remain visible for
-- reconciliation and can only move through the terminal-state exception in
-- the trigger below.
update public.billing_orders billing_order
set preview_state = 'void',
    execution_state = 'void',
    blocking_reasons = '["superseded_by_jobber_scheduled_services_v2"]'::jsonb,
    locked_at = null,
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
from public.atlas_pricing_snapshots snapshot
where snapshot.id = billing_order.pricing_snapshot_id
  and snapshot.engine_version is distinct from 'jobber-scheduled-services-v2'
  and billing_order.execution_state <> 'succeeded'
  and billing_order.attempt_count = 0
  and billing_order.stripe_payment_intent_id is null;

create or replace function public.validate_billing_order_truth()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  appointment_record public.member_appointments%rowtype;
  snapshot_record public.atlas_pricing_snapshots%rowtype;
  membership_record public.memberships%rowtype;
  agreement_record public.signed_agreements%rowtype;
  projection_record public.jobber_visit_projections%rowtype;
  effective_snapshot_amount integer;
  normalized_job_type text;
  normalized_billing_type text;
  charge_kind text;
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

  if new.preview_state = 'void' or new.execution_state = 'void' then
    if new.preview_state is distinct from 'void'
      or new.execution_state is distinct from 'void'
    then
      raise exception 'Billing order preview and execution must be voided together';
    end if;
    if tg_op = 'UPDATE'
      and (old.execution_state = 'processing' or old.stripe_payment_intent_id is not null)
    then
      raise exception 'A Stripe-contacted billing order must be reconciled before it can be voided';
    end if;
    return new;
  end if;

  -- Preserve the ability to record the final Stripe outcome after provider
  -- contact even if Jobber changes immediately afterward.
  if tg_op = 'UPDATE'
    and old.execution_state in (
      'pending', 'processing', 'failed_retryable', 'needs_action',
      'permanently_failed', 'reconciliation_required'
    )
    and new.execution_state in (
      'succeeded', 'failed_retryable', 'needs_action',
      'permanently_failed', 'reconciliation_required'
    )
    and new.membership_id = old.membership_id
    and new.property_id = old.property_id
    and new.obligation_id is not distinct from old.obligation_id
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

  if new.obligation_id is not null then
    raise exception 'Jobber scheduled-service billing orders cannot use an obligation price';
  end if;

  select * into appointment_record
  from public.member_appointments
  where id = new.appointment_id;
  if not found
    or appointment_record.property_id is distinct from new.property_id
    or lower(coalesce(appointment_record.provider, '')) <> 'jobber'
    or nullif(trim(coalesce(appointment_record.external_id, '')), '') is null
    or appointment_record.provenance_state not in ('provider_imported', 'manually_verified')
    or appointment_record.verification_state is distinct from 'verified'
    or appointment_record.match_state is distinct from 'matched'
    or appointment_record.status is distinct from 'scheduled'
  then
    raise exception 'Billing order requires a verified matched Jobber visit';
  end if;
  if appointment_record.scheduled_at is distinct from new.scheduled_service_at then
    raise exception 'Billing order service time must equal the verified Jobber visit time';
  end if;
  if new.service_month <> date_trunc(
    'month', appointment_record.scheduled_at at time zone 'America/Los_Angeles'
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
    or membership_record.property_id is distinct from new.property_id
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
    or agreement_record.billing_authorization_version is distinct from 'membership-jobber-scheduled-services-v2'
    or agreement_record.billing_authorized_at is null
    or agreement_record.billing_authorized_at < agreement_record.signed_at
    or agreement_record.billing_authorized_at > now() + interval '5 minutes'
    or agreement_record.authorized_visit_price_cents is distinct from round(membership_record.visit_price * 100)::integer
    or agreement_record.billing_terms_hash is distinct from 'ecced95eb6e32781764dccb83d1d33d5d9b1b86b2494a289ed5a0b1c6fd3b0fd'
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
    raise exception 'Billing order requires the current signed Jobber standing authorization';
  end if;

  select * into projection_record
  from public.jobber_visit_projections
  where connection_id = 'squeegeeking'
    and external_visit_id = appointment_record.external_id;
  normalized_job_type := regexp_replace(
    lower(coalesce(projection_record.job_type, '')), '[^a-z0-9]+', '_', 'g'
  );
  normalized_billing_type := regexp_replace(
    lower(coalesce(projection_record.job_billing_type, '')), '[^a-z0-9]+', '_', 'g'
  );
  charge_kind := case
    when normalized_job_type like '%one%' and normalized_job_type like '%off%'
      then 'one_off_job'
    when normalized_billing_type like '%visit%'
      then 'recurring_per_visit'
    when normalized_billing_type like '%fixed%'
      then 'recurring_fixed_price'
    else null
  end;

  if projection_record.id is null
    or projection_record.scheduled_start is distinct from appointment_record.scheduled_at
    or projection_record.is_complete = true
    or projection_record.match_state is distinct from 'matched'
    or projection_record.matched_property_id is distinct from new.property_id
    or projection_record.job_total_cents is null
    or projection_record.job_total_cents <= 0
    or projection_record.job_will_auto_charge = true
    or projection_record.visit_invoice_id is not null
    or charge_kind is null
    or (charge_kind = 'one_off_job' and projection_record.is_last_scheduled_visit is not true)
    or (charge_kind = 'recurring_fixed_price' and exists (
      select 1
      from public.jobber_visit_projections earlier
      where earlier.connection_id = projection_record.connection_id
        and earlier.external_job_id = projection_record.external_job_id
        and earlier.external_visit_id <> projection_record.external_visit_id
        and earlier.scheduled_start < projection_record.scheduled_start
        and date_trunc('month', earlier.scheduled_start at time zone 'America/Los_Angeles')::date = new.service_month
    ))
    or not exists (
      select 1
      from public.jobber_property_links property_link
      where property_link.connection_id = projection_record.connection_id
        and property_link.external_property_id = projection_record.external_property_id
        and property_link.membership_id = new.membership_id
        and property_link.property_id = new.property_id
        and property_link.link_state = 'active'
    )
  then
    raise exception 'Billing order requires an unbilled priced Jobber service at the paired property';
  end if;

  select * into snapshot_record
  from public.atlas_pricing_snapshots
  where id = new.pricing_snapshot_id;
  effective_snapshot_amount := coalesce(
    snapshot_record.override_amount_cents,
    snapshot_record.authorized_charge_cents
  );
  if snapshot_record.id is null
    or snapshot_record.membership_id is distinct from new.membership_id
    or snapshot_record.property_id is distinct from new.property_id
    or snapshot_record.obligation_id is not null
    or snapshot_record.engine_version is distinct from 'jobber-scheduled-services-v2'
    or snapshot_record.company_settings_hash is distinct from new.input_fingerprint
    or snapshot_record.normalized_inputs ->> 'external_job_id' is distinct from projection_record.external_job_id
    or snapshot_record.normalized_inputs ->> 'external_visit_id' is distinct from projection_record.external_visit_id
    or snapshot_record.normalized_inputs ->> 'jobber_source_payload_hash' is distinct from projection_record.source_payload_hash
    or snapshot_record.normalized_inputs ->> 'charge_kind' is distinct from charge_kind
    or coalesce((snapshot_record.normalized_inputs ->> 'job_total_cents')::integer, -1) is distinct from projection_record.job_total_cents
    or effective_snapshot_amount is distinct from projection_record.job_total_cents
    or new.amount_cents is distinct from effective_snapshot_amount
    or new.expected_charge_cents is distinct from effective_snapshot_amount
    or new.credit_applied_cents <> 0
  then
    raise exception 'Billing order amount must equal its immutable verified Jobber pricing snapshot';
  end if;

  if new.due_at is not null and (
    new.due_at at time zone 'America/Los_Angeles'
  )::date < new.service_month then
    raise exception 'Billing order cannot be due before its service month';
  end if;
  return new;
end;
$$;

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
  if p_completed_at is null
    or p_completed_at < now() - interval '5 minutes'
    or p_completed_at > now() + interval '5 minutes'
  then
    raise exception 'Billing completion time is outside the accepted clock window';
  end if;
  if p_intent_id is not null and nullif(trim(p_intent_id), '') is null then
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
    if order_record.stripe_payment_intent_id is distinct from p_intent_id then
      raise exception 'Succeeded billing order is bound to another PaymentIntent';
    end if;
    return order_record;
  end if;
  if p_attempt_number <> order_record.attempt_count then
    raise exception 'Billing attempt is not current';
  end if;
  if order_record.execution_state not in (
    'pending', 'processing', 'failed_retryable', 'needs_action',
    'permanently_failed', 'reconciliation_required'
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
  if not found then raise exception 'Billing attempt ledger row not found'; end if;
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
    and appointment_id = order_record.appointment_id
  for update;

  if charge_record.id is not null then
    if charge_record.service_month is distinct from order_record.service_month
      or round(charge_record.amount * 100)::integer <> order_record.expected_charge_cents
    then
      raise exception 'Existing billing ledger amount or month does not match the order';
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
      membership_id, homeowner_id, property_id, appointment_id,
      scheduled_service_at, service_month, visit_price, amount,
      amount_collected, authorized_amount_cents, status, charged_at,
      billing_method, stripe_reference, stripe_payment_intent_id, notes,
      created_by, attempt_count, last_attempt_at,
      billing_authority_verified_at, billing_authority_verified_by
    ) values (
      order_record.membership_id, membership_record.homeowner_id,
      order_record.property_id, order_record.appointment_id,
      order_record.scheduled_service_at, order_record.service_month,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents / 100.0,
      order_record.expected_charge_cents, 'paid', p_completed_at,
      'automatic_stripe',
      coalesce(nullif(trim(coalesce(p_stripe_reference, '')), ''), effective_intent_id),
      effective_intent_id,
      'Automatic first-of-service-month scheduled-service billing',
      'billing_automation', p_attempt_number, p_completed_at,
      p_completed_at, 'stripe_verified_billing_automation'
    );
  elsif charge_record.status not in ('paid', 'charged') then
    update public.membership_billing_charges
    set scheduled_service_at = order_record.scheduled_service_at,
        service_month = order_record.service_month,
        visit_price = order_record.expected_charge_cents / 100.0,
        amount = order_record.expected_charge_cents / 100.0,
        amount_collected = order_record.expected_charge_cents / 100.0,
        authorized_amount_cents = order_record.expected_charge_cents,
        status = 'paid',
        charged_at = p_completed_at,
        billing_method = 'automatic_stripe',
        stripe_reference = coalesce(
          nullif(trim(coalesce(p_stripe_reference, '')), ''), effective_intent_id
        ),
        stripe_payment_intent_id = effective_intent_id,
        attempt_count = p_attempt_number,
        last_attempt_at = p_completed_at,
        next_retry_at = null,
        failure_code = null,
        failure_message = null,
        billing_authority_verified_at = p_completed_at,
        billing_authority_verified_by = 'stripe_verified_billing_automation',
        notes = 'Automatic first-of-service-month scheduled-service billing'
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
  if p_completed_at is null
    or p_completed_at < now() - interval '5 minutes'
    or p_completed_at > now() + interval '5 minutes'
  then
    raise exception 'Billing completion time is outside the accepted clock window';
  end if;
  if p_intent_id is not null and nullif(trim(p_intent_id), '') is null then
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
  if p_outcome = 'failed_retryable'
    and (p_next_attempt_at is null or p_next_attempt_at <= p_completed_at)
  then
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
  if order_record.execution_state in ('succeeded', 'void') then return order_record; end if;
  if p_attempt_number <> order_record.attempt_count then return order_record; end if;
  if order_record.execution_state not in (
    'pending', 'processing', 'failed_retryable', 'needs_action',
    'permanently_failed', 'reconciliation_required'
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
  if not found then raise exception 'Billing attempt ledger row not found'; end if;
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
    and appointment_id = order_record.appointment_id
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

comment on table public.billing_orders is
  'Fail-closed first-of-service-month charges sourced from verified Jobber scheduled-service prices; global and per-member execution default off';
