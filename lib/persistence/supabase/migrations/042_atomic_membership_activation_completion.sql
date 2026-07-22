-- Migration 042: make Stripe membership activation completion atomic.
-- Run after 041_jobber_property_link_revocation.sql. Migration 037 remains
-- immutable history; this migration replaces only its activation RPC.

do $$
begin
  if to_regprocedure(
    'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)'
  ) is null
    or to_regclass('public.membership_payment_setup_events') is null
    or to_regclass('public.membership_stripe_setup_reconciliation_attempts') is null
    or to_regclass('public.membership_stripe_setup_reconciliation_events') is null
    or to_regclass('public.obligations') is null
    or to_regclass('public.obligation_events') is null
    or to_regclass('public.website_membership_sales') is null
  then
    raise exception using
      message = 'Migration 042 requires migrations 018, 022, and 037';
  end if;
end;
$$;

-- At most one canonical activation event can exist for an obligation. Later
-- status-transition events remain valid and do not affect activation replay.
create unique index if not exists obligation_events_membership_activated_uidx
  on public.obligation_events (obligation_id)
  where from_status is null
    and to_status = 'promised'
    and actor = 'system'
    and reason = 'membership_activated'
    and source = 'system';

-- The activation event is durable creation evidence. Other obligation events
-- remain available for legitimate append-only status transitions.
create or replace function public.reject_membership_activation_event_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.reason = 'membership_activated'
    or (tg_op = 'UPDATE' and new.reason = 'membership_activated')
  then
    raise exception 'Membership activation obligation evidence is immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists obligation_events_membership_activated_immutable
  on public.obligation_events;
create trigger obligation_events_membership_activated_immutable
  before update or delete on public.obligation_events
  for each row execute function public.reject_membership_activation_event_change();

create or replace function public.reject_website_membership_sale_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Website membership sale provenance is append-only and immutable';
end;
$$;

drop trigger if exists website_membership_sales_immutable
  on public.website_membership_sales;
create trigger website_membership_sales_immutable
  before update or delete on public.website_membership_sales
  for each row execute function public.reject_website_membership_sale_change();

-- Migration 018 left both obligation ledgers browser-writable through PUBLIC
-- FOR ALL policies. Activation now trusts these rows as durable evidence, so
-- remove every policy that can apply to either browser role and restore an
-- exact server-only table ACL.
alter table public.obligations enable row level security;
alter table public.obligation_events enable row level security;
alter table public.website_membership_sales enable row level security;
drop policy if exists "obligations_anon_all" on public.obligations;
drop policy if exists "obligation_events_anon_all" on public.obligation_events;
drop policy if exists "website_membership_sales_anon_all"
  on public.website_membership_sales;
drop policy if exists website_membership_sales_anon_read
  on public.website_membership_sales;
do $$
declare
  policy_row record;
begin
  for policy_row in
    select c.relname as table_name, p.polname as policy_name
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'obligations', 'obligation_events', 'website_membership_sales'
      )
      and exists (
        select 1
        from unnest(p.polroles) as policy_role(role_oid)
        where policy_role.role_oid = 0
          or pg_catalog.pg_has_role('anon', policy_role.role_oid, 'MEMBER')
          or pg_catalog.pg_has_role(
            'authenticated', policy_role.role_oid, 'MEMBER'
          )
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policy_name,
      policy_row.table_name
    );
  end loop;
end;
$$;
revoke all on table
  public.obligations,
  public.obligation_events,
  public.website_membership_sales
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.obligations to service_role;
grant select, insert on table public.obligation_events to service_role;
grant select on table public.website_membership_sales to service_role;
revoke all on function public.reject_website_membership_sale_change()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_membership_activation_event_change()
  from public, anon, authenticated, service_role;

create or replace function public.activate_membership_after_stripe_setup(
  p_membership_id uuid,
  p_presentation_id uuid,
  p_agreement_id uuid,
  p_homeowner_id uuid,
  p_property_id uuid,
  p_expected_authority_sha256 text,
  p_reconciliation_attempt_id uuid,
  p_stripe_customer_id text,
  p_stripe_setup_intent_id text,
  p_stripe_payment_method_id text,
  p_stripe_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  membership_row public.memberships;
  presentation_row public.presentations;
  agreement_row public.signed_agreements;
  signing_attempt_row public.presentation_signing_attempts;
  attempt_row public.membership_stripe_setup_reconciliation_attempts;
  homeowner_row public.homeowners;
  property_row public.properties;
  evidence_row public.membership_payment_setup_events;
  sale_row public.website_membership_sales;
  obligation_row public.obligations;
  completed_at timestamptz;
  locked_started_at timestamptz;
  quote_visit_price numeric;
  quote_enrollment_savings numeric;
  expected_visits_per_year smallint;
  expected_frequency text;
  expected_metadata jsonb;
  annualized_value numeric;
  sale_customer_name text;
  sale_customer_email text;
  sale_property_address text;
  activation_anchor date;
  activation_anchor_month date;
  months_per_window integer;
  window_start date;
  next_window_start date;
  window_end date;
  obligation_sequence integer;
  obligation_count integer;
  activation_event_count integer;
  mismatched_activation_event_count integer;
  activation_event_occurred_at timestamptz;
begin
  if p_stripe_customer_id is null
    or p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_stripe_setup_intent_id is null
    or p_stripe_setup_intent_id !~ '^seti_[A-Za-z0-9]+$'
    or p_stripe_payment_method_id is null
    or p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$'
    or p_expected_authority_sha256 is null
    or p_expected_authority_sha256 !~ '^[0-9a-f]{64}$'
    or p_stripe_livemode is null
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'invalid_stripe_reference');
  end if;

  select * into membership_row
  from public.memberships
  where id = p_membership_id
  for update;

  select * into presentation_row
  from public.presentations
  where id = p_presentation_id
  for update;

  select * into agreement_row
  from public.signed_agreements
  where id = p_agreement_id
  for update;

  select * into signing_attempt_row
  from public.presentation_signing_attempts
  where presentation_id = p_presentation_id
  for update;

  select * into homeowner_row
  from public.homeowners
  where id = p_homeowner_id
  for key share;

  select * into property_row
  from public.properties
  where id = p_property_id
  for key share;

  select * into attempt_row
  from public.membership_stripe_setup_reconciliation_attempts
  where id = p_reconciliation_attempt_id
  for update;

  select * into evidence_row
  from public.membership_payment_setup_events
  where membership_id = p_membership_id
  for key share;

  select * into sale_row
  from public.website_membership_sales
  where membership_id = p_membership_id
  for key share;

  perform 1
  from public.obligations
  where membership_id = p_membership_id and membership_year = 1
  order by sequence
  for update;

  expected_metadata := jsonb_build_object(
    'homeatlas_flow', 'membership_setup_v1',
    'membership_id', p_membership_id,
    'presentation_id', p_presentation_id,
    'agreement_id', p_agreement_id,
    'homeowner_id', p_homeowner_id,
    'property_id', p_property_id,
    'reconciliation_attempt_id', p_reconciliation_attempt_id,
    'presentation_authority_sha256', p_expected_authority_sha256
  );

  if membership_row.id is null
    or presentation_row.id is null
    or agreement_row.id is null
    or signing_attempt_row.presentation_id is null
    or homeowner_row.id is null
    or property_row.id is null
    or attempt_row.id is null
    or property_row.homeowner_id is distinct from p_homeowner_id
    or membership_row.homeowner_id is distinct from p_homeowner_id
    or membership_row.property_id is distinct from p_property_id
    or membership_row.presentation_id is distinct from p_presentation_id
    or membership_row.agreement_id is distinct from p_agreement_id
    or presentation_row.status is distinct from 'signed'
    or presentation_row.signed_at is null
    or presentation_row.membership_id is distinct from p_membership_id
    or presentation_row.agreement_id is distinct from p_agreement_id
    or presentation_row.homeowner_id is distinct from p_homeowner_id
    or presentation_row.property_id is distinct from p_property_id
    or agreement_row.status is distinct from 'complete'
    or agreement_row.membership_id is distinct from p_membership_id
    or agreement_row.presentation_id is distinct from p_presentation_id
    or agreement_row.homeowner_id is distinct from p_homeowner_id
    or agreement_row.property_id is distinct from p_property_id
    or signing_attempt_row.status is distinct from 'complete'
    or signing_attempt_row.agreement_id is distinct from p_agreement_id
    or signing_attempt_row.attempt_id is distinct from agreement_row.signing_attempt_id
    or signing_attempt_row.agreement_tier is distinct from membership_row.sales_tier
    or agreement_row.agreement_tier is distinct from membership_row.sales_tier
    or presentation_row.tier is distinct from membership_row.sales_tier
    or presentation_row.authority_sha256 is distinct from p_expected_authority_sha256
    or signing_attempt_row.presentation_authority_sha256 is distinct from p_expected_authority_sha256
    or presentation_row.quote_snapshot->>'authority' is distinct from 'atlas_pricing_engine_v1'
    or not (presentation_row.quote_snapshot ? 'tierVisitPrices')
    or not (presentation_row.quote_snapshot ? 'tierEnrollmentSavings')
    or membership_row.sales_tier not in ('biannual', 'quarterly')
    or membership_row.visit_price is null
    or membership_row.visit_price <= 0
    or attempt_row.membership_id is distinct from p_membership_id
    or attempt_row.presentation_id is distinct from p_presentation_id
    or attempt_row.agreement_id is distinct from p_agreement_id
    or attempt_row.homeowner_id is distinct from p_homeowner_id
    or attempt_row.property_id is distinct from p_property_id
    or attempt_row.presentation_authority_sha256 is distinct from p_expected_authority_sha256
    or attempt_row.customer_idempotency_key is distinct from
      format('homeatlas:membership-customer:v1:%s', p_membership_id)
    or attempt_row.setup_intent_idempotency_key is distinct from
      format('homeatlas:membership-setup:v2:%s', p_membership_id)
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'authoritative_linkage_changed');
  end if;

  expected_visits_per_year := case membership_row.sales_tier
    when 'quarterly' then 4
    when 'biannual' then 2
  end;
  expected_frequency := case membership_row.sales_tier
    when 'quarterly' then 'quarterly'
    when 'biannual' then 'bi_annual'
  end;
  begin
    quote_visit_price := (
      presentation_row.quote_snapshot->'tierVisitPrices'->>membership_row.sales_tier
    )::numeric;
    quote_enrollment_savings := (
      presentation_row.quote_snapshot->'tierEnrollmentSavings'->>membership_row.sales_tier
    )::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'held', 'reason', 'signed_pricing_authority_invalid');
  end;

  if quote_visit_price is distinct from membership_row.visit_price
    or quote_enrollment_savings is null
    or quote_enrollment_savings < 0
    or presentation_row.enrollment_savings is distinct from quote_enrollment_savings
    or (
      membership_row.membership_enrollment_savings is not null
      and membership_row.membership_enrollment_savings is distinct from quote_enrollment_savings
    )
    or membership_row.visits_per_year is distinct from expected_visits_per_year
    or presentation_row.quote_snapshot->>'frequency' is distinct from expected_frequency
    or attempt_row.sales_tier is distinct from membership_row.sales_tier
    or attempt_row.visit_price is distinct from membership_row.visit_price
    or attempt_row.visits_per_year is distinct from membership_row.visits_per_year
    or attempt_row.enrollment_savings is distinct from quote_enrollment_savings
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'signed_pricing_authority_changed');
  end if;

  if not exists (
    select 1
    from public.membership_stripe_setup_reconciliation_events
    where attempt_id = p_reconciliation_attempt_id
      and stripe_customer_id = p_stripe_customer_id
      and stripe_setup_intent_id = p_stripe_setup_intent_id
      and operation_status in ('created', 'observed', 'ready')
  ) then
    return jsonb_build_object('outcome', 'held', 'reason', 'provider_reconciliation_missing');
  end if;

  sale_customer_name := nullif(btrim(homeowner_row.full_name), '');
  sale_customer_email := nullif(btrim(homeowner_row.email), '');
  sale_property_address := nullif(concat_ws(', ',
    nullif(btrim(property_row.address), ''),
    nullif(concat_ws(', ',
      nullif(btrim(property_row.city), ''),
      nullif(concat_ws(' ',
        nullif(btrim(property_row.state), ''),
        nullif(btrim(property_row.zip), '')
      ), '')
    ), '')
  ), '');
  -- Reporting-only derivation from the locked Atlas terms. This does not
  -- create or accept independent pricing truth.
  annualized_value := membership_row.visit_price * membership_row.visits_per_year;

  if sale_customer_name is null or sale_property_address is null then
    return jsonb_build_object('outcome', 'held', 'reason', 'sale_provenance_missing');
  end if;

  select count(*)::integer into obligation_count
  from public.obligations
  where membership_id = p_membership_id and membership_year = 1;

  if membership_row.status = 'active'
    and membership_row.payment_setup_completed_at is not null
    and membership_row.started_at is not null
    and membership_row.stripe_customer_id is not distinct from p_stripe_customer_id
    and membership_row.stripe_setup_intent_id is not distinct from p_stripe_setup_intent_id
    and membership_row.stripe_payment_method_id is not distinct from p_stripe_payment_method_id
    and membership_row.membership_enrollment_savings is not distinct from quote_enrollment_savings
    and presentation_row.onboarding_status is not distinct from 'complete'
    and evidence_row.membership_id is not distinct from p_membership_id
    and evidence_row.reconciliation_attempt_id is not distinct from p_reconciliation_attempt_id
    and evidence_row.presentation_id is not distinct from p_presentation_id
    and evidence_row.agreement_id is not distinct from p_agreement_id
    and evidence_row.homeowner_id is not distinct from p_homeowner_id
    and evidence_row.property_id is not distinct from p_property_id
    and evidence_row.sales_tier is not distinct from membership_row.sales_tier
    and evidence_row.visit_price is not distinct from membership_row.visit_price
    and evidence_row.visits_per_year is not distinct from membership_row.visits_per_year
    and evidence_row.presentation_authority_sha256 is not distinct from p_expected_authority_sha256
    and evidence_row.enrollment_savings is not distinct from quote_enrollment_savings
    and evidence_row.stripe_customer_id is not distinct from p_stripe_customer_id
    and evidence_row.stripe_setup_intent_id is not distinct from p_stripe_setup_intent_id
    and evidence_row.stripe_payment_method_id is not distinct from p_stripe_payment_method_id
    and evidence_row.stripe_livemode is not distinct from p_stripe_livemode
    and evidence_row.stripe_setup_intent_status is not distinct from 'succeeded'
    and evidence_row.stripe_metadata is not distinct from expected_metadata
    and evidence_row.payment_setup_completed_at is not distinct from membership_row.payment_setup_completed_at
    and sale_row.membership_id is not distinct from p_membership_id
    and sale_row.homeowner_id is not distinct from p_homeowner_id
    and sale_row.property_id is not distinct from p_property_id
    and sale_row.presentation_id is not distinct from p_presentation_id
    and sale_row.agreement_id is not distinct from p_agreement_id
    and sale_row.customer_name is not distinct from sale_customer_name
    and sale_row.customer_email is not distinct from sale_customer_email
    and sale_row.property_address is not distinct from sale_property_address
    and sale_row.sales_tier is not distinct from evidence_row.sales_tier
    and sale_row.visit_price is not distinct from evidence_row.visit_price
    and sale_row.visits_per_year is not distinct from evidence_row.visits_per_year
    and sale_row.annualized_value is not distinct from annualized_value
    and sale_row.payment_setup_completed_at is not distinct from evidence_row.payment_setup_completed_at
    and sale_row.sold_at is not distinct from evidence_row.payment_setup_completed_at
    and sale_row.created_at is not distinct from evidence_row.payment_setup_completed_at
    and sale_row.source is not distinct from 'website_presentation'
    and obligation_count = expected_visits_per_year
  then
    activation_anchor := (membership_row.started_at at time zone 'UTC')::date;
    activation_anchor_month := make_date(
      extract(year from activation_anchor)::integer,
      extract(month from activation_anchor)::integer,
      1
    );
    months_per_window := 12 / expected_visits_per_year;

    for obligation_sequence in 1..expected_visits_per_year loop
      window_start := (
        activation_anchor_month + make_interval(
          months => (obligation_sequence - 1) * months_per_window,
          days => extract(day from activation_anchor)::integer - 1
        )
      )::date;
      next_window_start := (
        activation_anchor_month + make_interval(
          months => obligation_sequence * months_per_window,
          days => extract(day from activation_anchor)::integer - 1
        )
      )::date;
      window_end := next_window_start - 1;

      select * into obligation_row
      from public.obligations
      where membership_id = p_membership_id
        and membership_year = 1
        and sequence = obligation_sequence;

      if obligation_row.id is null
        or obligation_row.property_id is distinct from p_property_id
        or obligation_row.homeowner_id is distinct from p_homeowner_id
        or obligation_row.target_window_start is distinct from window_start
        or obligation_row.target_window_end is distinct from window_end
        or obligation_row.created_at is distinct from evidence_row.payment_setup_completed_at
      then
        return jsonb_build_object(
          'outcome', 'held',
          'reason', 'activation_completion_incomplete_or_mismatched'
        );
      end if;

      select count(*)::integer, max(occurred_at)
      into activation_event_count, activation_event_occurred_at
      from public.obligation_events
      where obligation_id = obligation_row.id
        and from_status is null
        and to_status = 'promised'
        and actor = 'system'
        and reason = 'membership_activated'
        and source = 'system';

      select count(*)::integer into mismatched_activation_event_count
      from public.obligation_events
      where obligation_id = obligation_row.id
        and reason = 'membership_activated'
        and not (
          from_status is null
          and to_status = 'promised'
          and actor = 'system'
          and source = 'system'
        );

      if activation_event_count <> 1
        or activation_event_occurred_at is distinct from evidence_row.payment_setup_completed_at
        or mismatched_activation_event_count <> 0
      then
        return jsonb_build_object(
          'outcome', 'held',
          'reason', 'activation_completion_incomplete_or_mismatched'
        );
      end if;
    end loop;

    return jsonb_build_object(
      'outcome', 'replay',
      'membership_id', membership_row.id,
      'presentation_id', presentation_row.id,
      'agreement_id', agreement_row.id,
      'homeowner_id', membership_row.homeowner_id,
      'property_id', membership_row.property_id,
      'sales_tier', evidence_row.sales_tier,
      'visit_price', evidence_row.visit_price,
      'visits_per_year', evidence_row.visits_per_year,
      'presentation_authority_sha256', evidence_row.presentation_authority_sha256,
      'enrollment_savings', evidence_row.enrollment_savings,
      'payment_setup_completed_at', evidence_row.payment_setup_completed_at,
      'started_at', membership_row.started_at,
      'sale_id', sale_row.id,
      'obligation_count', obligation_count
    );
  end if;

  if membership_row.status is distinct from 'pending_payment'
    or membership_row.payment_setup_completed_at is not null
    or membership_row.stripe_payment_method_id is not null
    or membership_row.stripe_customer_id is distinct from p_stripe_customer_id
    or membership_row.stripe_setup_intent_id is distinct from p_stripe_setup_intent_id
    or membership_row.membership_enrollment_savings is not null
    or presentation_row.onboarding_status is distinct from 'pending_payment'
    or evidence_row.id is not null
    or sale_row.id is not null
    or obligation_count <> 0
  then
    return jsonb_build_object(
      'outcome', 'held',
      'reason', 'activation_completion_incomplete_or_mismatched'
    );
  end if;

  completed_at := now();
  locked_started_at := coalesce(membership_row.started_at, completed_at);
  activation_anchor := (locked_started_at at time zone 'UTC')::date;
  activation_anchor_month := make_date(
    extract(year from activation_anchor)::integer,
    extract(month from activation_anchor)::integer,
    1
  );
  months_per_window := 12 / expected_visits_per_year;

  insert into public.membership_payment_setup_events (
    reconciliation_attempt_id, membership_id, presentation_id, agreement_id,
    homeowner_id, property_id, sales_tier, visit_price, visits_per_year,
    presentation_authority_sha256, enrollment_savings, stripe_customer_id,
    stripe_setup_intent_id, stripe_payment_method_id, stripe_livemode,
    stripe_setup_intent_status, stripe_metadata, payment_setup_completed_at
  ) values (
    p_reconciliation_attempt_id, p_membership_id, p_presentation_id,
    p_agreement_id, p_homeowner_id, p_property_id, membership_row.sales_tier,
    membership_row.visit_price, membership_row.visits_per_year,
    p_expected_authority_sha256, quote_enrollment_savings,
    p_stripe_customer_id, p_stripe_setup_intent_id,
    p_stripe_payment_method_id, p_stripe_livemode, 'succeeded',
    expected_metadata, completed_at
  ) returning * into evidence_row;

  for obligation_sequence in 1..expected_visits_per_year loop
    window_start := (
      activation_anchor_month + make_interval(
        months => (obligation_sequence - 1) * months_per_window,
        days => extract(day from activation_anchor)::integer - 1
      )
    )::date;
    next_window_start := (
      activation_anchor_month + make_interval(
        months => obligation_sequence * months_per_window,
        days => extract(day from activation_anchor)::integer - 1
      )
    )::date;
    window_end := next_window_start - 1;

    insert into public.obligations (
      membership_id, property_id, homeowner_id, sequence, membership_year,
      target_window_start, target_window_end, status, memory_status
    ) values (
      p_membership_id, p_property_id, p_homeowner_id, obligation_sequence, 1,
      window_start, window_end, 'promised', 'none'
    ) returning * into obligation_row;

    insert into public.obligation_events (
      obligation_id, from_status, to_status, actor, reason, source
    ) values (
      obligation_row.id, null, 'promised', 'system',
      'membership_activated', 'system'
    );
  end loop;

  obligation_count := expected_visits_per_year;

  insert into public.website_membership_sales (
    membership_id, homeowner_id, property_id, presentation_id, agreement_id,
    customer_name, customer_email, property_address, sales_tier, visit_price,
    visits_per_year, annualized_value, payment_setup_completed_at, sold_at,
    source
  ) values (
    p_membership_id, p_homeowner_id, p_property_id, p_presentation_id,
    p_agreement_id, sale_customer_name, sale_customer_email,
    sale_property_address, membership_row.sales_tier,
    membership_row.visit_price, membership_row.visits_per_year,
    annualized_value, completed_at, completed_at, 'website_presentation'
  ) returning * into sale_row;

  update public.memberships
  set status = 'active',
      payment_setup_completed_at = completed_at,
      started_at = locked_started_at,
      stripe_payment_method_id = p_stripe_payment_method_id,
      membership_enrollment_savings = quote_enrollment_savings,
      updated_at = completed_at
  where id = p_membership_id;

  update public.presentations
  set onboarding_status = 'complete',
      updated_at = completed_at
  where id = p_presentation_id;

  return jsonb_build_object(
    'outcome', 'activated',
    'membership_id', membership_row.id,
    'presentation_id', presentation_row.id,
    'agreement_id', agreement_row.id,
    'homeowner_id', membership_row.homeowner_id,
    'property_id', membership_row.property_id,
    'sales_tier', membership_row.sales_tier,
    'visit_price', membership_row.visit_price,
    'visits_per_year', membership_row.visits_per_year,
    'presentation_authority_sha256', p_expected_authority_sha256,
    'enrollment_savings', quote_enrollment_savings,
    'payment_setup_completed_at', completed_at,
    'started_at', locked_started_at,
    'sale_id', sale_row.id,
    'obligation_count', obligation_count
  );
end;
$$;

revoke all on function public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean
) to service_role;

do $$
declare
  function_mismatch_count integer;
  trigger_match_count integer;
  activation_index_match_count integer;
  table_acl_mismatch_count integer;
  browser_policy_count integer;
  rls_match_count integer;
begin
  with expected(function_name, argument_types, result_type, language_name,
    security_definer, is_strict, volatility, parallel_mode, function_config,
    body_md5) as (values
    ('activate_membership_after_stripe_setup',
      'uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean',
      'jsonb', 'plpgsql', true, false, 'v', 'u', 'search_path=pg_catalog',
      '1bd1f881ce2df4652f3b9b0ca149ab89'),
    ('reject_membership_activation_event_change', '', 'trigger', 'plpgsql',
      false, false, 'v', 'u', 'search_path=pg_catalog',
      '5940dd2b9a92c43116f2f2490c0466a6'),
    ('reject_website_membership_sale_change', '', 'trigger', 'plpgsql',
      false, false, 'v', 'u', 'search_path=pg_catalog',
      '8c27447f52e1b548babacebb80677a48')
  ), actual as (
    select
      p.proname::text as function_name,
      pg_catalog.oidvectortypes(p.proargtypes)::text as argument_types,
      pg_catalog.pg_get_function_result(p.oid)::text as result_type,
      l.lanname::text as language_name,
      p.prosecdef as security_definer,
      p.proisstrict as is_strict,
      p.provolatile::text as volatility,
      p.proparallel::text as parallel_mode,
      array_to_string(p.proconfig, ',')::text as function_config,
      md5(btrim(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g'))) as body_md5
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.proname in (
        'activate_membership_after_stripe_setup',
        'reject_membership_activation_event_change',
        'reject_website_membership_sale_change'
      )
  )
  select count(*) into function_mismatch_count
  from expected
  full outer join actual using (
    function_name, argument_types, result_type, language_name,
    security_definer, is_strict, volatility, parallel_mode, function_config,
    body_md5
  )
  where expected.function_name is null or actual.function_name is null;

  select count(*) into trigger_match_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and t.tgenabled = 'O'
    and t.tgtype = 27
    and n.nspname = 'public'
    and (
      (
        c.relname = 'obligation_events'
        and t.tgname = 'obligation_events_membership_activated_immutable'
        and t.tgfoid = 'public.reject_membership_activation_event_change()'::regprocedure
      )
      or (
        c.relname = 'website_membership_sales'
        and t.tgname = 'website_membership_sales_immutable'
        and t.tgfoid = 'public.reject_website_membership_sale_change()'::regprocedure
      )
    );

  select count(*) into activation_index_match_count
  from pg_catalog.pg_index i
  join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
  join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = table_class.relnamespace
  where n.nspname = 'public'
    and table_class.relname = 'obligation_events'
    and index_class.relname = 'obligation_events_membership_activated_uidx'
    and i.indisunique
    and i.indisvalid
    and i.indisready
    and i.indnkeyatts = 1
    and pg_catalog.pg_get_indexdef(i.indexrelid, 1, true) = 'obligation_id'
    and lower(regexp_replace(
      pg_catalog.pg_get_expr(i.indpred, i.indrelid),
      '[[:space:]()"]', '', 'g'
    )) =
      'from_statusisnullandto_status=''promised''::textandactor=''system''::textandreason=''membership_activated''::textandsource=''system''::text';

  with expected(
    table_name, grantee, privilege_type, is_grantable
  ) as (values
    ('obligation_events'::text, 'service_role'::text, 'INSERT'::text, false),
    ('obligation_events'::text, 'service_role'::text, 'SELECT'::text, false),
    ('obligations'::text, 'service_role'::text, 'INSERT'::text, false),
    ('obligations'::text, 'service_role'::text, 'SELECT'::text, false),
    ('obligations'::text, 'service_role'::text, 'UPDATE'::text, false),
    ('website_membership_sales'::text, 'service_role'::text, 'SELECT'::text,
      false)
  ), actual as (
    select
      c.relname::text as table_name,
      case
        when acl.grantee = 0 then 'PUBLIC'
        else grantee_role.rolname
      end::text as grantee,
      acl.privilege_type::text,
      acl.is_grantable
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    left join pg_catalog.pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    where n.nspname = 'public'
      and c.relname in (
        'obligations', 'obligation_events', 'website_membership_sales'
      )
      and acl.grantee <> c.relowner
  )
  select count(*) into table_acl_mismatch_count
  from expected
  full outer join actual using (
    table_name, grantee, privilege_type, is_grantable
  )
  where expected.table_name is null or actual.table_name is null;

  select count(*) into browser_policy_count
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'obligations', 'obligation_events', 'website_membership_sales'
    )
    and exists (
      select 1
      from unnest(p.polroles) as policy_role(role_oid)
      where policy_role.role_oid = 0
        or pg_catalog.pg_has_role('anon', policy_role.role_oid, 'MEMBER')
        or pg_catalog.pg_has_role(
          'authenticated', policy_role.role_oid, 'MEMBER'
        )
    );

  select count(*) into rls_match_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('obligations', 'obligation_events', 'website_membership_sales')
    and c.relrowsecurity;

  if function_mismatch_count <> 0
    or trigger_match_count <> 2
    or activation_index_match_count <> 1
    or table_acl_mismatch_count <> 0
    or browser_policy_count <> 0
    or rls_match_count <> 3
    or has_function_privilege(
      'anon',
      'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon', 'public.reject_membership_activation_event_change()', 'EXECUTE'
    )
    or has_function_privilege(
      'authenticated', 'public.reject_membership_activation_event_change()', 'EXECUTE'
    )
    or has_function_privilege(
      'service_role', 'public.reject_membership_activation_event_change()', 'EXECUTE'
    )
    or has_function_privilege(
      'anon', 'public.reject_website_membership_sale_change()', 'EXECUTE'
    )
    or has_function_privilege(
      'authenticated', 'public.reject_website_membership_sale_change()', 'EXECUTE'
    )
    or has_function_privilege(
      'service_role', 'public.reject_website_membership_sale_change()', 'EXECUTE'
    )
  then
    raise exception using
      message = 'Malformed migration 042 completion schema or ACL requires review';
  end if;
end;
$$;
