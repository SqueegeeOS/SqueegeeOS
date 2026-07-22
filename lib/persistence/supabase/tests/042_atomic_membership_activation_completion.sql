-- Disposable rehearsal for migration 042. Run only after migrations 018, 022,
-- 036, 037, and 042 on a non-production database. Every fixture rolls back.
begin;

create temporary table activation_042_fixtures (
  fixture_id uuid primary key,
  membership_id uuid not null,
  presentation_id uuid not null,
  agreement_id uuid not null,
  homeowner_id uuid not null,
  property_id uuid not null,
  reconciliation_attempt_id uuid not null,
  stripe_customer_id text not null,
  stripe_setup_intent_id text not null,
  stripe_payment_method_id text not null
) on commit drop;

create or replace function pg_temp.seed_activation_042(
  p_started_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $fixture$
declare
  v_fixture_id uuid := gen_random_uuid();
  v_presentation_id uuid := gen_random_uuid();
  v_homeowner_id uuid := gen_random_uuid();
  v_property_id uuid := gen_random_uuid();
  v_membership_id uuid := gen_random_uuid();
  v_signing_attempt_id uuid := gen_random_uuid();
  v_agreement_id uuid := gen_random_uuid();
  v_authority_sha256 text := repeat('a', 64);
  v_signature_sha256 text := repeat('b', 64);
  v_stripe_suffix text := replace(v_fixture_id::text, '-', '');
  v_customer_id text := 'cus_' || v_stripe_suffix;
  v_setup_intent_id text := 'seti_' || v_stripe_suffix;
  v_payment_method_id text := 'pm_' || v_stripe_suffix;
  v_reserve_result jsonb;
  v_reconciliation_attempt_id uuid;
begin
  insert into public.presentations (
    id, client_name, client_address, client_email, home_sqft, tier,
    quote_snapshot, authority_sha256, enrollment_savings, status
  ) values (
    v_presentation_id,
    'Migration 042 ' || v_fixture_id::text,
    left(v_fixture_id::text, 8) || ' Rehearsal Way, Chico, CA 95928',
    'migration-042-' || v_fixture_id::text || '@example.invalid',
    2500,
    'quarterly',
    jsonb_build_object(
      'sqft', 2500,
      'frequency', 'quarterly',
      'authority', 'atlas_pricing_engine_v1',
      'tierVisitPrices', jsonb_build_object('biannual', 320, 'quarterly', 225),
      'tierEnrollmentSavings', jsonb_build_object('biannual', 15, 'quarterly', 25)
    ),
    v_authority_sha256,
    25,
    'draft'
  );

  insert into public.homeowners (
    id, slug, full_name, first_name, email, source_presentation_id
  ) values (
    v_homeowner_id,
    'migration-042-' || v_fixture_id::text,
    'Migration 042 Member ' || v_fixture_id::text,
    'Migration',
    'migration-042-' || v_fixture_id::text || '@example.invalid',
    v_presentation_id
  );

  insert into public.properties (
    id, homeowner_id, slug, name, address, city, state, zip, type,
    source_presentation_id
  ) values (
    v_property_id,
    v_homeowner_id,
    'migration-042-' || v_fixture_id::text,
    'Migration 042 Disposable',
    left(v_fixture_id::text, 8) || ' Rehearsal Way',
    'Chico',
    'CA',
    '95928',
    'Residence',
    v_presentation_id
  );

  insert into public.memberships (
    id, homeowner_id, property_id, plan_id, plan_name, price_display,
    billing_period, status, presentation_id, sales_tier, visit_price,
    visits_per_year, started_at
  ) values (
    v_membership_id, v_homeowner_id, v_property_id, 'preferred', 'Quarterly',
    '$225/visit', 'per_visit', 'pending_payment', v_presentation_id,
    'quarterly', 225, 4, p_started_at
  );

  insert into public.presentation_signing_attempts (
    presentation_id, attempt_id, agreement_tier, signature_sha256,
    presentation_authority_sha256, status
  ) values (
    v_presentation_id, v_signing_attempt_id, 'quarterly', v_signature_sha256,
    v_authority_sha256, 'pending'
  );

  insert into public.signed_agreements (
    id, homeowner_id, property_id, membership_id, presentation_id,
    homeowner_slug, property_slug, homeowner_name, plan_id, plan_name,
    signature_method, signer_name, signed_at, status, signing_attempt_id,
    signing_evidence_sha256, agreement_tier
  ) values (
    v_agreement_id, v_homeowner_id, v_property_id, v_membership_id,
    v_presentation_id,
    'migration-042-' || v_fixture_id::text,
    'migration-042-' || v_fixture_id::text,
    'Migration 042 Member', 'preferred', 'Quarterly', 'drawn',
    'Migration 042 Member', now(), 'complete', v_signing_attempt_id,
    v_signature_sha256, 'quarterly'
  );

  update public.memberships
  set agreement_id = v_agreement_id
  where id = v_membership_id;

  update public.presentations
  set status = 'signed',
      signed_at = now(),
      agreement_id = v_agreement_id,
      homeowner_id = v_homeowner_id,
      property_id = v_property_id,
      membership_id = v_membership_id,
      onboarding_status = 'pending_payment'
  where id = v_presentation_id;

  update public.presentation_signing_attempts
  set status = 'complete', agreement_id = v_agreement_id
  where presentation_id = v_presentation_id;

  v_reserve_result := public.reserve_membership_stripe_setup_reconciliation(
    v_membership_id, v_presentation_id, v_agreement_id, v_homeowner_id,
    v_property_id, v_authority_sha256, 'presentation'
  );
  if v_reserve_result->>'outcome' not in ('reserved', 'replay') then
    raise exception 'Migration 042 fixture reservation failed: %', v_reserve_result;
  end if;
  v_reconciliation_attempt_id := (v_reserve_result->'attempt'->>'id')::uuid;

  perform public.append_membership_stripe_setup_reconciliation_event(
    v_reconciliation_attempt_id, 'customer_created', 'customer', 'created',
    v_customer_id, null, 'provider_resolved', null
  );
  perform public.append_membership_stripe_setup_reconciliation_event(
    v_reconciliation_attempt_id, 'setup_intent_created', 'setup_intent',
    'created', v_customer_id, v_setup_intent_id, 'provider_resolved', null
  );
  if public.claim_membership_stripe_setup(
    v_membership_id, v_presentation_id, v_agreement_id, v_homeowner_id,
    v_property_id, v_authority_sha256, v_reconciliation_attempt_id,
    v_customer_id, v_setup_intent_id
  )->>'outcome' <> 'claimed' then
    raise exception 'Migration 042 fixture provider claim failed';
  end if;

  insert into pg_temp.activation_042_fixtures values (
    v_fixture_id, v_membership_id, v_presentation_id, v_agreement_id,
    v_homeowner_id, v_property_id, v_reconciliation_attempt_id,
    v_customer_id, v_setup_intent_id, v_payment_method_id
  );
  return v_fixture_id;
end;
$fixture$;

create or replace function pg_temp.activate_042(p_fixture_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $activate$
declare
  fixture pg_temp.activation_042_fixtures;
begin
  select * into fixture
  from pg_temp.activation_042_fixtures
  where fixture_id = p_fixture_id;

  return public.activate_membership_after_stripe_setup(
    fixture.membership_id,
    fixture.presentation_id,
    fixture.agreement_id,
    fixture.homeowner_id,
    fixture.property_id,
    repeat('a', 64),
    fixture.reconciliation_attempt_id,
    fixture.stripe_customer_id,
    fixture.stripe_setup_intent_id,
    fixture.stripe_payment_method_id,
    false
  );
end;
$activate$;

-- Happy path, month-end parity, exact replay, and legitimate status transition.
do $rehearsal$
declare
  fixture_id uuid := pg_temp.seed_activation_042('2026-01-31 12:00:00+00');
  fixture pg_temp.activation_042_fixtures;
  result jsonb;
  actual_windows text[];
  durable_counts integer[];
begin
  select * into fixture from pg_temp.activation_042_fixtures f
  where f.fixture_id = fixture_id;

  result := pg_temp.activate_042(fixture_id);
  if result->>'outcome' <> 'activated' then
    raise exception 'Migration 042 happy path did not activate: %', result;
  end if;

  select array_agg(
    target_window_start::text || ':' || target_window_end::text
    order by sequence
  ) into actual_windows
  from public.obligations
  where membership_id = fixture.membership_id and membership_year = 1;
  if actual_windows is distinct from array[
    '2026-01-31:2026-04-30',
    '2026-05-01:2026-07-30',
    '2026-07-31:2026-10-30',
    '2026-10-31:2027-01-30'
  ]::text[] then
    raise exception 'Migration 042 month-end windows diverged: %', actual_windows;
  end if;

  select array[
    (select count(*)::integer from public.membership_payment_setup_events
      where membership_id = fixture.membership_id),
    (select count(*)::integer from public.website_membership_sales
      where membership_id = fixture.membership_id),
    (select count(*)::integer from public.obligations
      where membership_id = fixture.membership_id and membership_year = 1),
    (select count(*)::integer
      from public.obligation_events event
      join public.obligations obligation on obligation.id = event.obligation_id
      where obligation.membership_id = fixture.membership_id
        and obligation.membership_year = 1
        and event.reason = 'membership_activated')
  ] into durable_counts;
  if durable_counts is distinct from array[1, 1, 4, 4] then
    raise exception 'Migration 042 durable set was incomplete: %', durable_counts;
  end if;

  update public.obligations
  set status = 'scheduled'
  where membership_id = fixture.membership_id
    and membership_year = 1 and sequence = 1;
  insert into public.obligation_events (
    obligation_id, from_status, to_status, actor, reason, source
  ) select id, 'promised', 'scheduled', 'migration_042_rehearsal',
      'legitimate_status_transition', 'manual'
    from public.obligations
    where membership_id = fixture.membership_id
      and membership_year = 1 and sequence = 1;

  result := pg_temp.activate_042(fixture_id);
  if result->>'outcome' <> 'replay' then
    raise exception 'Migration 042 legitimate status replay did not converge: %', result;
  end if;
end;
$rehearsal$;

-- Partial pre-existing completion must hold without publishing activation.
do $rehearsal$
declare
  fixture_id uuid := pg_temp.seed_activation_042();
  fixture pg_temp.activation_042_fixtures;
  result jsonb;
begin
  select * into fixture from pg_temp.activation_042_fixtures f
  where f.fixture_id = fixture_id;
  insert into public.obligations (
    membership_id, property_id, homeowner_id, sequence, membership_year,
    target_window_start, target_window_end
  ) values (
    fixture.membership_id, fixture.property_id, fixture.homeowner_id, 1, 1,
    date '2026-01-01', date '2026-03-31'
  );

  result := pg_temp.activate_042(fixture_id);
  if result is distinct from jsonb_build_object(
    'outcome', 'held',
    'reason', 'activation_completion_incomplete_or_mismatched'
  ) then
    raise exception 'Migration 042 partial state was not held: %', result;
  end if;
  if exists (
    select 1 from public.memberships
    where id = fixture.membership_id and status <> 'pending_payment'
  ) or exists (
    select 1 from public.membership_payment_setup_events
    where membership_id = fixture.membership_id
  ) or exists (
    select 1 from public.website_membership_sales
    where membership_id = fixture.membership_id
  ) then
    raise exception 'Migration 042 partial state leaked published completion';
  end if;
end;
$rehearsal$;

-- A post-activation durable mismatch must hold on replay.
do $rehearsal$
declare
  fixture_id uuid := pg_temp.seed_activation_042();
  fixture pg_temp.activation_042_fixtures;
  result jsonb;
begin
  select * into fixture from pg_temp.activation_042_fixtures f
  where f.fixture_id = fixture_id;
  result := pg_temp.activate_042(fixture_id);
  if result->>'outcome' <> 'activated' then
    raise exception 'Migration 042 mismatch fixture did not activate';
  end if;
  update public.obligations
  set target_window_end = target_window_end + 1
  where membership_id = fixture.membership_id
    and membership_year = 1 and sequence = 2;
  result := pg_temp.activate_042(fixture_id);
  if result->>'outcome' <> 'held'
    or result->>'reason' <> 'activation_completion_incomplete_or_mismatched'
  then
    raise exception 'Migration 042 mismatched replay was accepted: %', result;
  end if;
end;
$rehearsal$;

-- Force the sale insert to fail after earlier writes; every activation write
-- must roll back to the pending fixture state.
create or replace function pg_temp.force_activation_042_sale_failure()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $failure$
begin
  raise exception 'forced migration 042 sale failure';
end;
$failure$;

create trigger force_activation_042_sale_failure
  before insert on public.website_membership_sales
  for each row execute function pg_temp.force_activation_042_sale_failure();

do $rehearsal$
declare
  fixture_id uuid := pg_temp.seed_activation_042();
  fixture pg_temp.activation_042_fixtures;
  failure_observed boolean := false;
begin
  select * into fixture from pg_temp.activation_042_fixtures f
  where f.fixture_id = fixture_id;
  begin
    perform pg_temp.activate_042(fixture_id);
  exception when raise_exception then
    failure_observed := position(
      'forced migration 042 sale failure' in sqlerrm
    ) > 0;
  end;
  if not failure_observed then
    raise exception 'Migration 042 forced sale failure did not propagate';
  end if;
  if exists (
    select 1 from public.membership_payment_setup_events
    where membership_id = fixture.membership_id
  ) or exists (
    select 1 from public.obligations
    where membership_id = fixture.membership_id
  ) or exists (
    select 1 from public.website_membership_sales
    where membership_id = fixture.membership_id
  ) or exists (
    select 1 from public.memberships
    where id = fixture.membership_id
      and (
        status <> 'pending_payment'
        or payment_setup_completed_at is not null
        or stripe_payment_method_id is not null
        or membership_enrollment_savings is not null
      )
  ) or exists (
    select 1 from public.presentations
    where id = fixture.presentation_id
      and onboarding_status <> 'pending_payment'
  ) then
    raise exception 'Migration 042 forced sale failure did not roll back';
  end if;
end;
$rehearsal$;

drop trigger force_activation_042_sale_failure
  on public.website_membership_sales;

-- ACL and immutable evidence checks.
do $rehearsal$
declare
  fixture_id uuid := pg_temp.seed_activation_042();
  fixture pg_temp.activation_042_fixtures;
  sale_immutable boolean := false;
  activation_event_immutable boolean := false;
begin
  select * into fixture from pg_temp.activation_042_fixtures f
  where f.fixture_id = fixture_id;
  perform pg_temp.activate_042(fixture_id);

  if exists (
    select 1
    from (values
      ('anon'::name, 'public.obligations'::text, 'SELECT'::text),
      ('anon'::name, 'public.obligations'::text, 'INSERT'::text),
      ('anon'::name, 'public.obligations'::text, 'UPDATE'::text),
      ('anon'::name, 'public.obligations'::text, 'DELETE'::text),
      ('anon'::name, 'public.obligation_events'::text, 'SELECT'::text),
      ('anon'::name, 'public.obligation_events'::text, 'INSERT'::text),
      ('anon'::name, 'public.obligation_events'::text, 'UPDATE'::text),
      ('anon'::name, 'public.obligation_events'::text, 'DELETE'::text),
      ('anon'::name, 'public.website_membership_sales'::text, 'SELECT'::text),
      ('anon'::name, 'public.website_membership_sales'::text, 'INSERT'::text),
      ('anon'::name, 'public.website_membership_sales'::text, 'UPDATE'::text),
      ('anon'::name, 'public.website_membership_sales'::text, 'DELETE'::text),
      ('authenticated'::name, 'public.obligations'::text, 'SELECT'::text),
      ('authenticated'::name, 'public.obligations'::text, 'INSERT'::text),
      ('authenticated'::name, 'public.obligations'::text, 'UPDATE'::text),
      ('authenticated'::name, 'public.obligations'::text, 'DELETE'::text),
      ('authenticated'::name, 'public.obligation_events'::text, 'SELECT'::text),
      ('authenticated'::name, 'public.obligation_events'::text, 'INSERT'::text),
      ('authenticated'::name, 'public.obligation_events'::text, 'UPDATE'::text),
      ('authenticated'::name, 'public.obligation_events'::text, 'DELETE'::text),
      ('authenticated'::name, 'public.website_membership_sales'::text, 'SELECT'::text),
      ('authenticated'::name, 'public.website_membership_sales'::text, 'INSERT'::text),
      ('authenticated'::name, 'public.website_membership_sales'::text, 'UPDATE'::text),
      ('authenticated'::name, 'public.website_membership_sales'::text, 'DELETE'::text)
    ) denied(role_name, table_name, privilege_type)
    where has_table_privilege(
      denied.role_name, denied.table_name, denied.privilege_type
    )
  ) or not has_table_privilege(
    'service_role', 'public.obligations', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.obligations', 'INSERT'
  ) or not has_table_privilege(
    'service_role', 'public.obligations', 'UPDATE'
  ) or has_table_privilege(
    'service_role', 'public.obligations', 'DELETE'
  ) or not has_table_privilege(
    'service_role', 'public.obligation_events', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.obligation_events', 'INSERT'
  ) or has_table_privilege(
    'service_role', 'public.obligation_events', 'UPDATE'
  ) or has_table_privilege(
    'service_role', 'public.obligation_events', 'DELETE'
  ) or not has_table_privilege(
    'service_role', 'public.website_membership_sales', 'SELECT'
  ) or has_table_privilege(
    'service_role', 'public.website_membership_sales', 'INSERT'
  ) or has_table_privilege(
    'service_role', 'public.website_membership_sales', 'UPDATE'
  ) or has_table_privilege(
    'service_role', 'public.website_membership_sales', 'DELETE'
  ) or exists (
    select 1
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
  ) or has_function_privilege(
    'anon',
    'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Migration 042 ACL rehearsal failed';
  end if;

  begin
    update public.website_membership_sales
    set customer_name = customer_name
    where membership_id = fixture.membership_id;
  exception when raise_exception then
    sale_immutable := position('append-only and immutable' in sqlerrm) > 0;
  end;
  begin
    update public.obligation_events event
    set actor = event.actor
    from public.obligations obligation
    where obligation.id = event.obligation_id
      and obligation.membership_id = fixture.membership_id
      and event.reason = 'membership_activated';
  exception when raise_exception then
    activation_event_immutable := position(
      'activation obligation evidence is immutable' in lower(sqlerrm)
    ) > 0;
  end;
  if not sale_immutable or not activation_event_immutable then
    raise exception 'Migration 042 immutable evidence rehearsal failed';
  end if;
end;
$rehearsal$;

rollback;
