-- PR1c: bind public card setup to authoritative HomeAtlas identity and Stripe proof.
-- Run after 036_hq_authority_input_closure.sql. Do not apply from application code.

alter table public.memberships
  add column if not exists stripe_setup_intent_id text;

create unique index if not exists memberships_stripe_setup_intent_uidx
  on public.memberships (stripe_setup_intent_id)
  where stripe_setup_intent_id is not null;

comment on column public.memberships.stripe_setup_intent_id is
  'Stripe SetupIntent authoritatively bound to this pending membership before activation';

-- The existing implementation treats stripe_customer_id as membership-bound.
-- Refuse to guess through legacy duplicates; migration must stop for review.
do $$
begin
  if to_regclass('public.memberships_stripe_customer_uidx') is null then
    if exists (
      select 1
      from public.memberships
      where stripe_customer_id is not null
      group by stripe_customer_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot enforce Stripe customer identity: duplicate membership bindings require review';
    end if;

    create unique index memberships_stripe_customer_uidx
      on public.memberships (stripe_customer_id)
      where stripe_customer_id is not null;
  end if;
end $$;

-- Durable HomeAtlas intent exists before the route may create or retrieve any
-- Stripe resource. The immutable row carries deterministic provider keys;
-- later observations are append-only events and are never repaired in place.
create table if not exists public.membership_stripe_setup_reconciliation_attempts (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique
    references public.memberships(id) on delete restrict,
  presentation_id uuid not null
    references public.presentations(id) on delete restrict,
  agreement_id uuid not null
    references public.signed_agreements(id) on delete restrict,
  homeowner_id uuid not null
    references public.homeowners(id) on delete restrict,
  property_id uuid not null
    references public.properties(id) on delete restrict,
  capability_kind text not null
    constraint membership_stripe_setup_reconciliation_attempts_capability_kind_check
    check (capability_kind in ('presentation', 'portal')),
  sales_tier text not null
    constraint membership_stripe_setup_reconciliation_attempts_sales_tier_check
    check (sales_tier in ('biannual', 'quarterly')),
  visit_price numeric(10, 2) not null
    constraint membership_stripe_setup_reconciliation_attempts_visit_price_check
    check (visit_price > 0),
  visits_per_year smallint not null
    constraint membership_stripe_setup_reconciliation_attempts_visits_per_year_check
    check (
      (sales_tier = 'biannual' and visits_per_year = 2)
      or (sales_tier = 'quarterly' and visits_per_year = 4)
    ),
  enrollment_savings numeric(10, 2) not null
    constraint membership_stripe_setup_reconciliation_attempts_enrollment_savings_check
    check (enrollment_savings >= 0),
  presentation_authority_sha256 text not null
    constraint membership_stripe_setup_reconciliation_attempts_authority_sha256_check
    check (presentation_authority_sha256 ~ '^[0-9a-f]{64}$'),
  customer_idempotency_key text not null unique
    constraint membership_stripe_setup_reconciliation_attempts_customer_key_check
    check (customer_idempotency_key ~ '^homeatlas:membership-customer:v1:[0-9a-f-]{36}$'),
  setup_intent_idempotency_key text not null unique
    constraint membership_stripe_setup_reconciliation_attempts_intent_key_check
    check (setup_intent_idempotency_key ~ '^homeatlas:membership-setup:v2:[0-9a-f-]{36}$'),
  operation_phase text not null default 'before_provider'
    constraint membership_stripe_setup_reconciliation_attempts_phase_check
    check (operation_phase = 'before_provider'),
  operation_status text not null default 'reserved'
    constraint membership_stripe_setup_reconciliation_attempts_status_check
    check (operation_status = 'reserved'),
  created_at timestamptz not null default now()
);

create table if not exists public.membership_stripe_setup_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.membership_stripe_setup_reconciliation_attempts(id)
    on delete restrict,
  event_key text not null
    constraint membership_stripe_setup_reconciliation_events_event_key_check
    check (event_key ~ '^[a-z0-9_:-]{1,96}$'),
  operation_phase text not null
    constraint membership_stripe_setup_reconciliation_events_phase_check
    check (operation_phase in ('customer', 'setup_intent', 'claim', 'activation')),
  operation_status text not null
    constraint membership_stripe_setup_reconciliation_events_status_check
    check (operation_status in (
      'observed', 'created', 'claimed', 'ready', 'held', 'failed',
      'activated', 'replayed'
    )),
  stripe_customer_id text
    constraint membership_stripe_setup_reconciliation_events_customer_check
    check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_setup_intent_id text
    constraint membership_stripe_setup_reconciliation_events_intent_check
    check (stripe_setup_intent_id is null or stripe_setup_intent_id ~ '^seti_[A-Za-z0-9]+$'),
  outcome text
    constraint membership_stripe_setup_reconciliation_events_outcome_check
    check (outcome is null or outcome in (
      'provider_resolved', 'claimed', 'held', 'failed', 'ready', 'activated', 'replay'
    )),
  error_code text
    constraint membership_stripe_setup_reconciliation_events_error_check
    check (error_code is null or error_code ~ '^[a-z0-9_:-]{1,128}$'),
  occurred_at timestamptz not null default now(),
  unique (attempt_id, event_key),
  constraint membership_stripe_setup_reconciliation_events_error_state_check
    check (
      (operation_status in ('held', 'failed') and error_code is not null)
      or (operation_status not in ('held', 'failed') and error_code is null)
    )
);

-- Existing malformed pre-release drafts are not safe to coerce or backfill.
-- Stop before provider authority can depend on an ambiguous schema.
do $$
declare
  malformed_count integer;
begin
  select count(*) into malformed_count
  from (values
    ('membership_stripe_setup_reconciliation_attempts', 'id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'presentation_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'agreement_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'homeowner_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'property_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'capability_kind', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'sales_tier', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'visit_price', 'numeric', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'visits_per_year', 'smallint', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'enrollment_savings', 'numeric', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'presentation_authority_sha256', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'customer_idempotency_key', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'setup_intent_idempotency_key', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'operation_phase', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'operation_status', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_attempts', 'created_at', 'timestamp with time zone', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'attempt_id', 'uuid', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'event_key', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'operation_phase', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'operation_status', 'text', 'NO'),
    ('membership_stripe_setup_reconciliation_events', 'stripe_customer_id', 'text', 'YES'),
    ('membership_stripe_setup_reconciliation_events', 'stripe_setup_intent_id', 'text', 'YES'),
    ('membership_stripe_setup_reconciliation_events', 'outcome', 'text', 'YES'),
    ('membership_stripe_setup_reconciliation_events', 'error_code', 'text', 'YES'),
    ('membership_stripe_setup_reconciliation_events', 'occurred_at', 'timestamp with time zone', 'NO')
  ) expected(table_name, column_name, data_type, is_nullable)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
   and actual.data_type = expected.data_type
   and actual.is_nullable = expected.is_nullable
  where actual.column_name is null;

  if malformed_count <> 0 then
    raise exception using
      message = 'Malformed PR1c reconciliation schema requires review';
  end if;
end $$;

create table if not exists public.membership_payment_setup_events (
  id uuid primary key default gen_random_uuid(),
  reconciliation_attempt_id uuid not null unique
    references public.membership_stripe_setup_reconciliation_attempts(id)
    on delete restrict,
  membership_id uuid not null unique
    references public.memberships(id) on delete restrict,
  presentation_id uuid not null
    references public.presentations(id) on delete restrict,
  agreement_id uuid not null
    references public.signed_agreements(id) on delete restrict,
  homeowner_id uuid not null
    references public.homeowners(id) on delete restrict,
  property_id uuid not null
    references public.properties(id) on delete restrict,
  sales_tier text not null constraint membership_payment_setup_events_sales_tier_check
    check (sales_tier in ('biannual', 'quarterly')),
  visit_price numeric(10, 2) not null constraint membership_payment_setup_events_visit_price_check
    check (visit_price > 0),
  visits_per_year smallint not null constraint membership_payment_setup_events_visits_per_year_check
    check (
      (sales_tier = 'biannual' and visits_per_year = 2)
      or (sales_tier = 'quarterly' and visits_per_year = 4)
    ),
  presentation_authority_sha256 text not null constraint membership_payment_setup_events_authority_sha256_check
    check (presentation_authority_sha256 ~ '^[0-9a-f]{64}$'),
  enrollment_savings numeric(10, 2) not null constraint membership_payment_setup_events_enrollment_savings_check
    check (enrollment_savings >= 0),
  stripe_customer_id text not null unique,
  stripe_setup_intent_id text not null unique,
  stripe_payment_method_id text not null,
  stripe_livemode boolean not null,
  stripe_setup_intent_status text not null
    check (stripe_setup_intent_status = 'succeeded'),
  stripe_metadata jsonb not null,
  payment_setup_completed_at timestamptz not null,
  occurred_at timestamptz not null default now()
);

-- Fail loudly if a partially applied pre-release draft exists. There is no
-- safe provenance backfill for immutable activation evidence.
alter table public.membership_payment_setup_events
  add column if not exists reconciliation_attempt_id uuid,
  add column if not exists sales_tier text,
  add column if not exists visit_price numeric(10, 2),
  add column if not exists visits_per_year smallint,
  add column if not exists presentation_authority_sha256 text,
  add column if not exists enrollment_savings numeric(10, 2);

alter table public.membership_payment_setup_events
  alter column reconciliation_attempt_id set not null,
  alter column sales_tier set not null,
  alter column visit_price set not null,
  alter column visits_per_year set not null,
  alter column presentation_authority_sha256 set not null,
  alter column enrollment_savings set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_reconciliation_attempt_id_key'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_reconciliation_attempt_id_key
      unique (reconciliation_attempt_id);
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_reconciliation_attempt_id_fkey'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_reconciliation_attempt_id_fkey
      foreign key (reconciliation_attempt_id)
      references public.membership_stripe_setup_reconciliation_attempts(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_sales_tier_check'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_sales_tier_check
      check (sales_tier in ('biannual', 'quarterly'));
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_visit_price_check'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_visit_price_check
      check (visit_price > 0);
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_visits_per_year_check'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_visits_per_year_check
      check (
        (sales_tier = 'biannual' and visits_per_year = 2)
        or (sales_tier = 'quarterly' and visits_per_year = 4)
      );
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_authority_sha256_check'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_authority_sha256_check
      check (presentation_authority_sha256 ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'membership_payment_setup_events_enrollment_savings_check'
      and conrelid = 'public.membership_payment_setup_events'::regclass
  ) then
    alter table public.membership_payment_setup_events
      add constraint membership_payment_setup_events_enrollment_savings_check
      check (enrollment_savings >= 0);
  end if;
end $$;

-- A rerun must never silently accept a weakened same-name constraint. Compare
-- every PR1c constraint after normalizing only whitespace and case from
-- PostgreSQL's catalog representation.
do $$
declare
  mismatch_count integer;
begin
  with expected(table_name, constraint_name, canonical_definition) as (values
    ('membership_payment_setup_events', 'membership_payment_setup_events_pkey', 'primarykey(id)'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_reconciliation_attempt_id_key', 'unique(reconciliation_attempt_id)'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_membership_id_key', 'unique(membership_id)'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_stripe_customer_id_key', 'unique(stripe_customer_id)'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_stripe_setup_intent_id_key', 'unique(stripe_setup_intent_id)'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_reconciliation_attempt_id_fkey', 'foreignkey(reconciliation_attempt_id)referencesmembership_stripe_setup_reconciliation_attempts(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_membership_id_fkey', 'foreignkey(membership_id)referencesmemberships(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_presentation_id_fkey', 'foreignkey(presentation_id)referencespresentations(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_agreement_id_fkey', 'foreignkey(agreement_id)referencessigned_agreements(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_homeowner_id_fkey', 'foreignkey(homeowner_id)referenceshomeowners(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_property_id_fkey', 'foreignkey(property_id)referencesproperties(id)ondeleterestrict'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_sales_tier_check', 'check((sales_tier=any(array[''biannual''::text,''quarterly''::text])))'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_visit_price_check', 'check((visit_price>(0)::numeric))'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_visits_per_year_check', 'check((((sales_tier=''biannual''::text)and(visits_per_year=2))or((sales_tier=''quarterly''::text)and(visits_per_year=4))))'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_authority_sha256_check', 'check((presentation_authority_sha256~''^[0-9a-f]{64}$''::text))'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_enrollment_savings_check', 'check((enrollment_savings>=(0)::numeric))'),
    ('membership_payment_setup_events', 'membership_payment_setup_events_stripe_setup_intent_status_check', 'check((stripe_setup_intent_status=''succeeded''::text))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_pkey', 'primarykey(id)'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_membership_id_key', 'unique(membership_id)'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_customer_idempotency_key_key', 'unique(customer_idempotency_key)'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_setup_intent_idempotency_key_key', 'unique(setup_intent_idempotency_key)'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_membership_id_fkey', 'foreignkey(membership_id)referencesmemberships(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_presentation_id_fkey', 'foreignkey(presentation_id)referencespresentations(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_agreement_id_fkey', 'foreignkey(agreement_id)referencessigned_agreements(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_homeowner_id_fkey', 'foreignkey(homeowner_id)referenceshomeowners(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_property_id_fkey', 'foreignkey(property_id)referencesproperties(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_capability_kind_check', 'check((capability_kind=any(array[''presentation''::text,''portal''::text])))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_sales_tier_check', 'check((sales_tier=any(array[''biannual''::text,''quarterly''::text])))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_visit_price_check', 'check((visit_price>(0)::numeric))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_visits_per_year_check', 'check((((sales_tier=''biannual''::text)and(visits_per_year=2))or((sales_tier=''quarterly''::text)and(visits_per_year=4))))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_enrollment_savings_check', 'check((enrollment_savings>=(0)::numeric))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_authority_sha256_check', 'check((presentation_authority_sha256~''^[0-9a-f]{64}$''::text))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_customer_key_check', 'check((customer_idempotency_key~''^homeatlas:membership-customer:v1:[0-9a-f-]{36}$''::text))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_intent_key_check', 'check((setup_intent_idempotency_key~''^homeatlas:membership-setup:v2:[0-9a-f-]{36}$''::text))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_phase_check', 'check((operation_phase=''before_provider''::text))'),
    ('membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_attempts_status_check', 'check((operation_status=''reserved''::text))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_pkey', 'primarykey(id)'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_attempt_id_event_key_key', 'unique(attempt_id,event_key)'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_attempt_id_fkey', 'foreignkey(attempt_id)referencesmembership_stripe_setup_reconciliation_attempts(id)ondeleterestrict'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_event_key_check', 'check((event_key~''^[a-z0-9_:-]{1,96}$''::text))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_phase_check', 'check((operation_phase=any(array[''customer''::text,''setup_intent''::text,''claim''::text,''activation''::text])))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_status_check', 'check((operation_status=any(array[''observed''::text,''created''::text,''claimed''::text,''ready''::text,''held''::text,''failed''::text,''activated''::text,''replayed''::text])))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_customer_check', 'check(((stripe_customer_idisnull)or(stripe_customer_id~''^cus_[a-za-z0-9]+$''::text)))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_intent_check', 'check(((stripe_setup_intent_idisnull)or(stripe_setup_intent_id~''^seti_[a-za-z0-9]+$''::text)))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_outcome_check', 'check(((outcomeisnull)or(outcome=any(array[''provider_resolved''::text,''claimed''::text,''held''::text,''failed''::text,''ready''::text,''activated''::text,''replay''::text]))))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_error_check', 'check(((error_codeisnull)or(error_code~''^[a-z0-9_:-]{1,128}$''::text)))'),
    ('membership_stripe_setup_reconciliation_events', 'membership_stripe_setup_reconciliation_events_error_state_check', 'check((((operation_status=any(array[''held''::text,''failed''::text]))and(error_codeisnotnull))or((operation_status<>all(array[''held''::text,''failed''::text]))and(error_codeisnull))))')
  ), actual as (
    select
      c.relname::text as table_name,
      k.conname::text as constraint_name,
      regexp_replace(
        lower(pg_catalog.pg_get_constraintdef(k.oid, false)),
        '[[:space:]]+', '', 'g'
      ) as canonical_definition
    from pg_catalog.pg_constraint k
    join pg_catalog.pg_class c on c.oid = k.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'membership_payment_setup_events',
        'membership_stripe_setup_reconciliation_attempts',
        'membership_stripe_setup_reconciliation_events'
      )
  )
  select count(*) into mismatch_count
  from expected
  full outer join actual using (table_name, constraint_name, canonical_definition)
  where expected.constraint_name is null or actual.constraint_name is null;

  if mismatch_count <> 0 then
    raise exception using
      message = 'Malformed PR1c constraint definitions require review';
  end if;
end $$;

-- Existing PR1c functions must be the exact prior migration definitions. A
-- partial or weakened same-name function is evidence of drift, not permission
-- to replace history silently. Hashes are over whitespace-normalized prosrc.
do $$
declare
  existing_count integer;
  mismatch_count integer;
begin
  select count(*) into existing_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'reject_membership_payment_setup_event_change',
      'reserve_membership_stripe_setup_reconciliation',
      'append_membership_stripe_setup_reconciliation_event',
      'claim_membership_stripe_setup',
      'activate_membership_after_stripe_setup'
    );

  if existing_count <> 0 then
    with expected(function_name, argument_types, result_type, language_name,
      security_definer, is_strict, volatility, parallel_mode, body_md5) as (values
      ('reject_membership_payment_setup_event_change', '', 'trigger', 'plpgsql', false, false, 'v', 'u', '59f2ded13ab83a4e618d22b9a2b189e7'),
      ('reserve_membership_stripe_setup_reconciliation', 'uuid, uuid, uuid, uuid, uuid, text, text', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'd5d7354afaa5c16c76ad0087920ff2f8'),
      ('append_membership_stripe_setup_reconciliation_event', 'uuid, text, text, text, text, text, text, text', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'd82f6ce2aa2aead47e6818227f739020'),
      ('claim_membership_stripe_setup', 'uuid, uuid, uuid, uuid, uuid, text, uuid, text, text', 'jsonb', 'plpgsql', false, false, 'v', 'u', '20a8650237fe48c8deb5e7a7ad86716a'),
      ('activate_membership_after_stripe_setup', 'uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'e463bd2e8f6fadbf3a2f3f2a150cce62')
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
        md5(btrim(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g'))) as body_md5
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      join pg_catalog.pg_language l on l.oid = p.prolang
      where n.nspname = 'public'
        and p.proname in (
          'reject_membership_payment_setup_event_change',
          'reserve_membership_stripe_setup_reconciliation',
          'append_membership_stripe_setup_reconciliation_event',
          'claim_membership_stripe_setup',
          'activate_membership_after_stripe_setup'
        )
        and p.proconfig = array['search_path=pg_catalog']::text[]
    )
    select count(*) into mismatch_count
    from expected
    full outer join actual using (
      function_name, argument_types, result_type, language_name,
      security_definer, is_strict, volatility, parallel_mode, body_md5
    )
    where expected.function_name is null or actual.function_name is null;

    if existing_count <> 5 or mismatch_count <> 0 then
      raise exception using
        message = 'Malformed PR1c function definitions require review';
    end if;
  end if;
end $$;

create or replace function public.reject_membership_payment_setup_event_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Stripe setup evidence is append-only and immutable';
end;
$$;

drop trigger if exists membership_stripe_setup_reconciliation_attempts_immutable
  on public.membership_stripe_setup_reconciliation_attempts;
create trigger membership_stripe_setup_reconciliation_attempts_immutable
  before update or delete on public.membership_stripe_setup_reconciliation_attempts
  for each row execute function public.reject_membership_payment_setup_event_change();

drop trigger if exists membership_stripe_setup_reconciliation_events_immutable
  on public.membership_stripe_setup_reconciliation_events;
create trigger membership_stripe_setup_reconciliation_events_immutable
  before update or delete on public.membership_stripe_setup_reconciliation_events
  for each row execute function public.reject_membership_payment_setup_event_change();

drop trigger if exists membership_payment_setup_events_immutable
  on public.membership_payment_setup_events;
create trigger membership_payment_setup_events_immutable
  before update or delete on public.membership_payment_setup_events
  for each row execute function public.reject_membership_payment_setup_event_change();

alter table public.membership_payment_setup_events enable row level security;
alter table public.membership_stripe_setup_reconciliation_attempts enable row level security;
alter table public.membership_stripe_setup_reconciliation_events enable row level security;

revoke all on table public.membership_payment_setup_events,
  public.membership_stripe_setup_reconciliation_attempts,
  public.membership_stripe_setup_reconciliation_events
  from public, anon, authenticated, service_role;
grant select on table public.membership_payment_setup_events,
  public.membership_stripe_setup_reconciliation_attempts,
  public.membership_stripe_setup_reconciliation_events
  to service_role;

revoke all on function public.reject_membership_payment_setup_event_change()
  from public, anon, authenticated;
grant execute on function public.reject_membership_payment_setup_event_change()
  to service_role;

create or replace function public.reserve_membership_stripe_setup_reconciliation(
  p_membership_id uuid,
  p_presentation_id uuid,
  p_agreement_id uuid,
  p_homeowner_id uuid,
  p_property_id uuid,
  p_expected_authority_sha256 text,
  p_capability_kind text
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
  property_homeowner_id uuid;
  homeowner_exists boolean;
  quote_visit_price numeric;
  quote_enrollment_savings numeric;
  expected_visits_per_year smallint;
begin
  if p_expected_authority_sha256 is null
    or p_expected_authority_sha256 !~ '^[0-9a-f]{64}$'
    or p_capability_kind is null
    or p_capability_kind not in ('presentation', 'portal')
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'invalid_reconciliation_authority');
  end if;

  select * into membership_row from public.memberships
  where id = p_membership_id for update;
  select * into presentation_row from public.presentations
  where id = p_presentation_id for update;
  select * into agreement_row from public.signed_agreements
  where id = p_agreement_id for update;
  select * into signing_attempt_row from public.presentation_signing_attempts
  where presentation_id = p_presentation_id for update;
  select true into homeowner_exists from public.homeowners
  where id = p_homeowner_id for key share;
  select homeowner_id into property_homeowner_id from public.properties
  where id = p_property_id for key share;

  if membership_row.id is null
    or presentation_row.id is null
    or agreement_row.id is null
    or homeowner_exists is distinct from true
    or property_homeowner_id is distinct from p_homeowner_id
    or membership_row.status is distinct from 'pending_payment'
    or membership_row.payment_setup_completed_at is not null
    or membership_row.stripe_payment_method_id is not null
    or membership_row.homeowner_id is distinct from p_homeowner_id
    or membership_row.property_id is distinct from p_property_id
    or membership_row.presentation_id is distinct from p_presentation_id
    or membership_row.agreement_id is distinct from p_agreement_id
    or presentation_row.status is distinct from 'signed'
    or presentation_row.onboarding_status is distinct from 'pending_payment'
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
    or membership_row.sales_tier not in ('biannual', 'quarterly')
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'authoritative_reconciliation_state_changed');
  end if;

  expected_visits_per_year := case membership_row.sales_tier
    when 'quarterly' then 4 when 'biannual' then 2 end;
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
    or membership_row.visits_per_year is distinct from expected_visits_per_year
    or quote_enrollment_savings is null
    or quote_enrollment_savings < 0
    or presentation_row.enrollment_savings is distinct from quote_enrollment_savings
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'signed_pricing_authority_changed');
  end if;

  select * into attempt_row
  from public.membership_stripe_setup_reconciliation_attempts
  where membership_id = p_membership_id
  for update;

  if attempt_row.id is not null then
    if attempt_row.presentation_id is distinct from p_presentation_id
      or attempt_row.agreement_id is distinct from p_agreement_id
      or attempt_row.homeowner_id is distinct from p_homeowner_id
      or attempt_row.property_id is distinct from p_property_id
      or attempt_row.sales_tier is distinct from membership_row.sales_tier
      or attempt_row.visit_price is distinct from membership_row.visit_price
      or attempt_row.visits_per_year is distinct from membership_row.visits_per_year
      or attempt_row.enrollment_savings is distinct from quote_enrollment_savings
      or attempt_row.presentation_authority_sha256 is distinct from p_expected_authority_sha256
    then
      return jsonb_build_object('outcome', 'held', 'reason', 'reconciliation_attempt_conflict');
    end if;
    return jsonb_build_object('outcome', 'replay', 'attempt', to_jsonb(attempt_row));
  end if;

  insert into public.membership_stripe_setup_reconciliation_attempts (
    membership_id, presentation_id, agreement_id, homeowner_id, property_id,
    capability_kind, sales_tier, visit_price, visits_per_year,
    enrollment_savings, presentation_authority_sha256,
    customer_idempotency_key, setup_intent_idempotency_key
  ) values (
    p_membership_id, p_presentation_id, p_agreement_id, p_homeowner_id,
    p_property_id, p_capability_kind, membership_row.sales_tier,
    membership_row.visit_price, membership_row.visits_per_year,
    quote_enrollment_savings, p_expected_authority_sha256,
    format('homeatlas:membership-customer:v1:%s', p_membership_id),
    format('homeatlas:membership-setup:v2:%s', p_membership_id)
  ) returning * into attempt_row;

  return jsonb_build_object('outcome', 'reserved', 'attempt', to_jsonb(attempt_row));
end;
$$;

create or replace function public.append_membership_stripe_setup_reconciliation_event(
  p_attempt_id uuid,
  p_event_key text,
  p_operation_phase text,
  p_operation_status text,
  p_stripe_customer_id text,
  p_stripe_setup_intent_id text,
  p_outcome text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  attempt_row public.membership_stripe_setup_reconciliation_attempts;
  existing_row public.membership_stripe_setup_reconciliation_events;
  inserted_row public.membership_stripe_setup_reconciliation_events;
begin
  if p_event_key is null
    or p_event_key !~ '^[a-z0-9_:-]{1,96}$'
    or p_operation_phase is null
    or p_operation_phase not in ('customer', 'setup_intent', 'claim', 'activation')
    or p_operation_status is null
    or p_operation_status not in (
      'observed', 'created', 'claimed', 'ready', 'held', 'failed',
      'activated', 'replayed'
    )
    or (p_stripe_customer_id is not null and p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$')
    or (p_stripe_setup_intent_id is not null and p_stripe_setup_intent_id !~ '^seti_[A-Za-z0-9]+$')
    or (p_error_code is not null and p_error_code !~ '^[a-z0-9_:-]{1,128}$')
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'invalid_reconciliation_event');
  end if;

  select * into attempt_row
  from public.membership_stripe_setup_reconciliation_attempts
  where id = p_attempt_id
  for update;
  if attempt_row.id is null then
    return jsonb_build_object('outcome', 'held', 'reason', 'reconciliation_attempt_missing');
  end if;

  select * into existing_row
  from public.membership_stripe_setup_reconciliation_events
  where attempt_id = p_attempt_id and event_key = p_event_key;
  if existing_row.id is not null then
    if existing_row.operation_phase is not distinct from p_operation_phase
      and existing_row.operation_status is not distinct from p_operation_status
      and existing_row.stripe_customer_id is not distinct from p_stripe_customer_id
      and existing_row.stripe_setup_intent_id is not distinct from p_stripe_setup_intent_id
      and existing_row.outcome is not distinct from p_outcome
      and existing_row.error_code is not distinct from p_error_code
    then
      return jsonb_build_object('outcome', 'replay', 'event_id', existing_row.id);
    end if;
    return jsonb_build_object('outcome', 'held', 'reason', 'reconciliation_event_conflict');
  end if;

  if exists (
    select 1 from public.membership_stripe_setup_reconciliation_events
    where attempt_id = p_attempt_id
      and stripe_customer_id is not null
      and p_stripe_customer_id is not null
      and stripe_customer_id <> p_stripe_customer_id
  ) or exists (
    select 1 from public.membership_stripe_setup_reconciliation_events
    where attempt_id = p_attempt_id
      and stripe_setup_intent_id is not null
      and p_stripe_setup_intent_id is not null
      and stripe_setup_intent_id <> p_stripe_setup_intent_id
  ) then
    return jsonb_build_object('outcome', 'held', 'reason', 'provider_reconciliation_conflict');
  end if;

  insert into public.membership_stripe_setup_reconciliation_events (
    attempt_id, event_key, operation_phase, operation_status,
    stripe_customer_id, stripe_setup_intent_id, outcome, error_code
  ) values (
    p_attempt_id, p_event_key, p_operation_phase, p_operation_status,
    p_stripe_customer_id, p_stripe_setup_intent_id, p_outcome, p_error_code
  ) returning * into inserted_row;

  return jsonb_build_object('outcome', 'appended', 'event_id', inserted_row.id);
end;
$$;

-- Claims the server-created Stripe customer and SetupIntent against locked,
-- signed HomeAtlas linkage. The function never accepts browser identity or
-- lifecycle values and cannot activate a membership.
drop function if exists public.claim_membership_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, text
);
drop function if exists public.claim_membership_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, text, text
);
drop function if exists public.claim_membership_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text
);
create or replace function public.claim_membership_stripe_setup(
  p_membership_id uuid,
  p_presentation_id uuid,
  p_agreement_id uuid,
  p_homeowner_id uuid,
  p_property_id uuid,
  p_expected_authority_sha256 text,
  p_reconciliation_attempt_id uuid,
  p_stripe_customer_id text,
  p_stripe_setup_intent_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  membership_row public.memberships;
  presentation_row public.presentations;
  agreement_row public.signed_agreements;
  signing_attempt_row public.presentation_signing_attempts;
  attempt_row public.membership_stripe_setup_reconciliation_attempts;
  property_homeowner_id uuid;
  homeowner_exists boolean;
  quote_visit_price numeric;
  quote_enrollment_savings numeric;
  expected_visits_per_year smallint;
  expected_frequency text;
begin
  if p_stripe_customer_id is null
    or p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_expected_authority_sha256 is null
    or p_expected_authority_sha256 !~ '^[0-9a-f]{64}$'
    or (p_stripe_setup_intent_id is not null
      and p_stripe_setup_intent_id !~ '^seti_[A-Za-z0-9]+$')
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'invalid_stripe_reference');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_stripe_customer_id, 0)
  );
  if exists (
    select 1
    from public.memberships
    where stripe_customer_id = p_stripe_customer_id
      and id <> p_membership_id
  ) then
    return jsonb_build_object('outcome', 'held', 'reason', 'stripe_customer_already_bound');
  end if;

  if p_stripe_setup_intent_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_stripe_setup_intent_id, 0)
    );
    if exists (
      select 1
      from public.memberships
      where stripe_setup_intent_id = p_stripe_setup_intent_id
        and id <> p_membership_id
    ) then
      return jsonb_build_object('outcome', 'held', 'reason', 'stripe_setup_intent_already_bound');
    end if;
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

  select true into homeowner_exists
  from public.homeowners
  where id = p_homeowner_id
  for key share;

  select homeowner_id into property_homeowner_id
  from public.properties
  where id = p_property_id
  for key share;

  select * into attempt_row
  from public.membership_stripe_setup_reconciliation_attempts
  where id = p_reconciliation_attempt_id
  for update;

  if membership_row.id is null
    or presentation_row.id is null
    or agreement_row.id is null
    or attempt_row.id is null
    or homeowner_exists is distinct from true
    or property_homeowner_id is distinct from p_homeowner_id
    or membership_row.status is distinct from 'pending_payment'
    or membership_row.payment_setup_completed_at is not null
    or membership_row.stripe_payment_method_id is not null
    or membership_row.homeowner_id is distinct from p_homeowner_id
    or membership_row.property_id is distinct from p_property_id
    or membership_row.presentation_id is distinct from p_presentation_id
    or membership_row.agreement_id is distinct from p_agreement_id
    or presentation_row.status is distinct from 'signed'
    or presentation_row.signed_at is null
    or presentation_row.onboarding_status is distinct from 'pending_payment'
    or presentation_row.membership_id is distinct from p_membership_id
    or presentation_row.agreement_id is distinct from p_agreement_id
    or presentation_row.homeowner_id is distinct from p_homeowner_id
    or presentation_row.property_id is distinct from p_property_id
    or agreement_row.status is distinct from 'complete'
    or agreement_row.membership_id is distinct from p_membership_id
    or agreement_row.presentation_id is distinct from p_presentation_id
    or agreement_row.homeowner_id is distinct from p_homeowner_id
    or agreement_row.property_id is distinct from p_property_id
    or signing_attempt_row.presentation_id is null
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
    return jsonb_build_object('outcome', 'held', 'reason', 'authoritative_linkage_or_state_changed');
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
  ) or (
    p_stripe_setup_intent_id is not null
    and not exists (
      select 1
      from public.membership_stripe_setup_reconciliation_events
      where attempt_id = p_reconciliation_attempt_id
        and stripe_customer_id = p_stripe_customer_id
        and stripe_setup_intent_id = p_stripe_setup_intent_id
    )
  ) then
    return jsonb_build_object('outcome', 'held', 'reason', 'provider_reconciliation_missing');
  end if;

  if membership_row.stripe_customer_id is not null
    and membership_row.stripe_customer_id is distinct from p_stripe_customer_id
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'stripe_customer_conflict');
  end if;

  if p_stripe_setup_intent_id is not null
    and membership_row.stripe_setup_intent_id is not null
    and membership_row.stripe_setup_intent_id is distinct from p_stripe_setup_intent_id
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'stripe_setup_intent_conflict');
  end if;

  update public.memberships
  set stripe_customer_id = p_stripe_customer_id,
      stripe_setup_intent_id = coalesce(
        stripe_setup_intent_id,
        p_stripe_setup_intent_id
      ),
      updated_at = now()
  where id = p_membership_id;

  return jsonb_build_object(
    'outcome', 'claimed',
    'stripe_customer_id', p_stripe_customer_id,
    'stripe_setup_intent_id', coalesce(
      membership_row.stripe_setup_intent_id,
      p_stripe_setup_intent_id
    )
  );
end;
$$;

-- Atomically activates only the same locked membership/presentation/agreement
-- that claimed the provider objects. An exact completed replay is successful;
-- every other active, paused, cancelled, stale, or conflicting state is held.
drop function if exists public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, text, text, boolean
);
drop function if exists public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, boolean
);
drop function if exists public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean
);
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
  property_homeowner_id uuid;
  homeowner_exists boolean;
  completed_at timestamptz;
  locked_started_at timestamptz;
  quote_visit_price numeric;
  quote_enrollment_savings numeric;
  expected_visits_per_year smallint;
  expected_frequency text;
  evidence_row public.membership_payment_setup_events;
  expected_metadata jsonb;
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

  select true into homeowner_exists
  from public.homeowners
  where id = p_homeowner_id
  for key share;

  select homeowner_id into property_homeowner_id
  from public.properties
  where id = p_property_id
  for key share;

  select * into attempt_row
  from public.membership_stripe_setup_reconciliation_attempts
  where id = p_reconciliation_attempt_id
  for update;

  select * into evidence_row
  from public.membership_payment_setup_events
  where membership_id = p_membership_id;

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
    or attempt_row.id is null
    or homeowner_exists is distinct from true
    or property_homeowner_id is distinct from p_homeowner_id
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
    or signing_attempt_row.presentation_id is null
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

  if membership_row.status = 'active'
    and membership_row.payment_setup_completed_at is not null
    and membership_row.stripe_customer_id is not distinct from p_stripe_customer_id
    and membership_row.stripe_setup_intent_id is not distinct from p_stripe_setup_intent_id
    and membership_row.stripe_payment_method_id is not distinct from p_stripe_payment_method_id
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
  then
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
      'started_at', membership_row.started_at
    );
  end if;

  if membership_row.status is distinct from 'pending_payment'
    or membership_row.payment_setup_completed_at is not null
    or membership_row.stripe_payment_method_id is not null
    or membership_row.stripe_customer_id is distinct from p_stripe_customer_id
    or membership_row.stripe_setup_intent_id is distinct from p_stripe_setup_intent_id
    or presentation_row.onboarding_status is distinct from 'pending_payment'
  then
    return jsonb_build_object('outcome', 'held', 'reason', 'membership_or_provider_replay_conflict');
  end if;

  completed_at := now();
  locked_started_at := coalesce(membership_row.started_at, completed_at);

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

  insert into public.membership_payment_setup_events (
    reconciliation_attempt_id,
    membership_id,
    presentation_id,
    agreement_id,
    homeowner_id,
    property_id,
    sales_tier,
    visit_price,
    visits_per_year,
    presentation_authority_sha256,
    enrollment_savings,
    stripe_customer_id,
    stripe_setup_intent_id,
    stripe_payment_method_id,
    stripe_livemode,
    stripe_setup_intent_status,
    stripe_metadata,
    payment_setup_completed_at
  ) values (
    p_reconciliation_attempt_id,
    p_membership_id,
    p_presentation_id,
    p_agreement_id,
    p_homeowner_id,
    p_property_id,
    membership_row.sales_tier,
    membership_row.visit_price,
    membership_row.visits_per_year,
    p_expected_authority_sha256,
    quote_enrollment_savings,
    p_stripe_customer_id,
    p_stripe_setup_intent_id,
    p_stripe_payment_method_id,
    p_stripe_livemode,
    'succeeded',
    expected_metadata,
    completed_at
  );

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
    'started_at', locked_started_at
  );
end;
$$;

revoke all on function public.claim_membership_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.reserve_membership_stripe_setup_reconciliation(
  uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.append_membership_stripe_setup_reconciliation_event(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.claim_membership_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text
) to service_role;
grant execute on function public.activate_membership_after_stripe_setup(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean
) to service_role;
grant execute on function public.reserve_membership_stripe_setup_reconciliation(
  uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.append_membership_stripe_setup_reconciliation_event(
  uuid, text, text, text, text, text, text, text
) to service_role;

-- Verify the definitions just installed as well as guarding reruns above.
do $$
declare
  mismatch_count integer;
begin
  with expected(function_name, argument_types, result_type, language_name,
    security_definer, is_strict, volatility, parallel_mode, body_md5) as (values
    ('reject_membership_payment_setup_event_change', '', 'trigger', 'plpgsql', false, false, 'v', 'u', '59f2ded13ab83a4e618d22b9a2b189e7'),
    ('reserve_membership_stripe_setup_reconciliation', 'uuid, uuid, uuid, uuid, uuid, text, text', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'd5d7354afaa5c16c76ad0087920ff2f8'),
    ('append_membership_stripe_setup_reconciliation_event', 'uuid, text, text, text, text, text, text, text', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'd82f6ce2aa2aead47e6818227f739020'),
    ('claim_membership_stripe_setup', 'uuid, uuid, uuid, uuid, uuid, text, uuid, text, text', 'jsonb', 'plpgsql', false, false, 'v', 'u', '20a8650237fe48c8deb5e7a7ad86716a'),
    ('activate_membership_after_stripe_setup', 'uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean', 'jsonb', 'plpgsql', true, false, 'v', 'u', 'e463bd2e8f6fadbf3a2f3f2a150cce62')
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
      md5(btrim(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g'))) as body_md5
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.proname in (
        'reject_membership_payment_setup_event_change',
        'reserve_membership_stripe_setup_reconciliation',
        'append_membership_stripe_setup_reconciliation_event',
        'claim_membership_stripe_setup',
        'activate_membership_after_stripe_setup'
      )
      and p.proconfig = array['search_path=pg_catalog']::text[]
  )
  select count(*) into mismatch_count
  from expected
  full outer join actual using (
    function_name, argument_types, result_type, language_name,
    security_definer, is_strict, volatility, parallel_mode, body_md5
  )
  where expected.function_name is null or actual.function_name is null;

  if mismatch_count <> 0 then
    raise exception using
      message = 'Malformed PR1c function definitions require review';
  end if;
end $$;
