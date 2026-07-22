-- Migration 036: close browser authority over customer and presentation state.
-- Run after 035_hq_authenticated_access.sql.
-- Safe to re-run. This migration never reopens anonymous writes.

-- Customer records remain RLS-protected. Service-role server routes are the
-- only mutation authority after this migration.
alter table if exists public.homeowners enable row level security;
alter table if exists public.properties enable row level security;
alter table if exists public.home_care_plans enable row level security;
alter table if exists public.memberships enable row level security;
alter table if exists public.signed_agreements enable row level security;
alter table if exists public.property_assets enable row level security;
alter table if exists public.presentations enable row level security;
alter table if exists public.pricing_settings enable row level security;

-- Presentation-derived customer rows use the presentation as their immutable
-- source identity. Name/address slugs remain readable labels, never merge keys.
alter table public.homeowners
  add column if not exists source_presentation_id uuid
    references public.presentations(id) on delete set null;
alter table public.properties
  add column if not exists source_presentation_id uuid
    references public.presentations(id) on delete set null;
alter table public.properties
  add column if not exists authority_address_key text generated always as (
    lower(btrim(regexp_replace(address, '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(city, '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(state, '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(zip, '[[:space:]]+', ' ', 'g')))
  ) stored;

create unique index if not exists homeowners_source_presentation_uidx
  on public.homeowners(source_presentation_id)
  where source_presentation_id is not null;
create unique index if not exists properties_source_presentation_uidx
  on public.properties(source_presentation_id)
  where source_presentation_id is not null;

do $$
begin
  if to_regclass('public.properties_authority_address_uidx') is null then
    if exists (
      select 1
      from public.properties
      group by authority_address_key
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot enforce normalized property identity: address variants require review';
    end if;
    create unique index properties_authority_address_uidx
      on public.properties(authority_address_key);
  end if;
end $$;

alter table public.signed_agreements
  add column if not exists signing_attempt_id uuid,
  add column if not exists signing_evidence_sha256 text,
  add column if not exists agreement_tier text;
alter table public.presentations
  add column if not exists authority_sha256 text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'signed_agreements_signing_evidence_sha256_check'
      and conrelid = 'public.signed_agreements'::regclass
  ) then
    alter table public.signed_agreements
      add constraint signed_agreements_signing_evidence_sha256_check
      check (
        signing_evidence_sha256 is null
        or signing_evidence_sha256 ~ '^[0-9a-f]{64}$'
      );
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'signed_agreements_agreement_tier_check'
      and conrelid = 'public.signed_agreements'::regclass
  ) then
    alter table public.signed_agreements
      add constraint signed_agreements_agreement_tier_check
      check (agreement_tier is null or agreement_tier in ('biannual', 'quarterly'));
  end if;
end $$;

create table if not exists public.presentation_signing_attempts (
  presentation_id uuid primary key
    references public.presentations(id) on delete restrict,
  attempt_id uuid not null unique,
  agreement_tier text not null
    check (agreement_tier in ('biannual', 'quarterly')),
  signature_sha256 text not null
    check (signature_sha256 ~ '^[0-9a-f]{64}$'),
  presentation_authority_sha256 text not null
    check (presentation_authority_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'held')),
  agreement_id uuid references public.signed_agreements(id) on delete restrict,
  conflict_count integer not null default 0 check (conflict_count >= 0),
  last_conflict_at timestamptz,
  last_conflict_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'signed_agreements_signing_attempt_fk'
      and conrelid = 'public.signed_agreements'::regclass
  ) then
    alter table public.signed_agreements
      add constraint signed_agreements_signing_attempt_fk
      foreign key (signing_attempt_id)
      references public.presentation_signing_attempts(attempt_id)
      on delete restrict;
  end if;
end $$;

alter table public.presentation_signing_attempts enable row level security;

create unique index if not exists signed_agreements_signing_attempt_uidx
  on public.signed_agreements(signing_attempt_id)
  where signing_attempt_id is not null;

-- Drop every mutating policy that grants public, anon, or authenticated
-- authority, including historical policies with names other than migration 030.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'homeowners',
        'properties',
        'home_care_plans',
        'memberships',
        'signed_agreements',
        'property_assets',
        'presentations',
        'pricing_settings'
      ])
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and roles::text[] && array['public', 'anon', 'authenticated']::text[]
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

-- Browser presentation access is mediated by server routes/capabilities.
-- Direct table reads make customer plans and presentation capabilities
-- enumerable. Drop every browser read policy, including historical policies
-- with an unexpected name, without touching service-role policies.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'homeowners',
        'properties',
        'home_care_plans',
        'memberships',
        'signed_agreements',
        'property_assets',
        'presentations',
        'pricing_settings'
      ])
      and cmd = 'SELECT'
      and roles::text[] && array['public', 'anon', 'authenticated']::text[]
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

revoke select, insert, update, delete on table public.homeowners
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.properties
  from public, anon, authenticated;
revoke insert, update, delete on table public.home_care_plans
  from public, anon, authenticated;
revoke select on table public.home_care_plans
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.memberships
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.signed_agreements
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.property_assets
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.presentations
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.pricing_settings
  from public, anon, authenticated;
revoke all on table public.presentation_signing_attempts
  from public, anon, authenticated;

revoke all on table public.homeowners from service_role;
revoke all on table public.properties from service_role;
revoke all on table public.home_care_plans from service_role;
revoke all on table public.memberships from service_role;
revoke all on table public.signed_agreements from service_role;
revoke all on table public.property_assets from service_role;
revoke all on table public.presentations from service_role;
revoke all on table public.pricing_settings from service_role;
revoke all on table public.presentation_signing_attempts from service_role;
grant select, insert, update, delete on table public.homeowners to service_role;
grant select, insert, update, delete on table public.properties to service_role;
grant select, insert, update, delete on table public.home_care_plans to service_role;
grant select, insert, update, delete on table public.memberships to service_role;
grant select, insert, update, delete on table public.signed_agreements to service_role;
grant select, insert, update, delete on table public.property_assets to service_role;
grant select, insert, update, delete on table public.presentations to service_role;
grant select, insert, update, delete on table public.pricing_settings to service_role;
grant select, insert, update, delete on table public.presentation_signing_attempts
  to service_role;

-- Completed agreements are signed evidence. Preserve INSERT so finalization can
-- create the completed row atomically, and preserve mutation of incomplete rows
-- for retry/repair workflows, but reject every later UPDATE or DELETE once the
-- stored row is complete (including service-role mutations and FK actions).
create or replace function public.reject_completed_signed_agreement_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.status = 'complete' then
    raise exception using
      errcode = '23514',
      message = 'Completed signed agreements are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists signed_agreements_complete_immutable
  on public.signed_agreements;
create trigger signed_agreements_complete_immutable
  before update or delete on public.signed_agreements
  for each row execute function public.reject_completed_signed_agreement_mutation();

revoke all on function public.reject_completed_signed_agreement_mutation()
  from public, anon, authenticated, service_role;
grant execute on function public.reject_completed_signed_agreement_mutation()
  to service_role;

-- One completed agreement per presentation makes customer retries converge on
-- immutable evidence instead of creating a second signed agreement.
do $$
begin
  if to_regclass('public.signed_agreements_complete_presentation_uidx') is null then
    if exists (
      select 1
      from public.signed_agreements
      where presentation_id is not null and status = 'complete'
      group by presentation_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot enforce signing idempotency: duplicate completed presentation agreements require review';
    end if;

    create unique index signed_agreements_complete_presentation_uidx
      on public.signed_agreements (presentation_id)
      where presentation_id is not null and status = 'complete';
  end if;
end $$;

-- Narrow transactional persistence for the authenticated Home Care Plan
-- authoring flow. The route supplies a validated domain document; this function
-- preserves existing source IDs and commits homeowner/property/plan together.
create or replace function public.save_hq_home_care_plan(
  p_homeowner_slug text,
  p_homeowner_full_name text,
  p_homeowner_first_name text,
  p_homeowner_email text,
  p_homeowner_phone text,
  p_property_slug text,
  p_property_name text,
  p_property_address text,
  p_property_city text,
  p_property_state text,
  p_property_zip text,
  p_property_type text,
  p_property_hero_image text,
  p_property_home_care_score smallint,
  p_property_year_built smallint,
  p_property_narrative text,
  p_presentation jsonb,
  p_draft jsonb
)
returns public.home_care_plans
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  homeowner_row public.homeowners;
  property_row public.properties;
  plan_row public.home_care_plans;
  property_address_key text;
begin
  if nullif(btrim(p_homeowner_slug), '') is null
    or nullif(btrim(p_property_slug), '') is null
    or nullif(btrim(p_homeowner_full_name), '') is null
    or nullif(btrim(p_property_name), '') is null
    or jsonb_typeof(p_presentation) <> 'object'
    or (p_draft is not null and jsonb_typeof(p_draft) <> 'object')
  then
    raise exception using message = 'Invalid Home Care Plan authority input';
  end if;

  property_address_key :=
    lower(btrim(regexp_replace(coalesce(p_property_address, ''), '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(coalesce(p_property_city, ''), '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(coalesce(p_property_state, ''), '[[:space:]]+', ' ', 'g'))) || '|' ||
    lower(btrim(regexp_replace(coalesce(p_property_zip, ''), '[[:space:]]+', ' ', 'g')));

  insert into public.homeowners (
    slug, full_name, first_name, email, phone
  ) values (
    p_homeowner_slug,
    p_homeowner_full_name,
    p_homeowner_first_name,
    p_homeowner_email,
    p_homeowner_phone
  )
  on conflict (slug) do nothing
  returning * into homeowner_row;

  if homeowner_row.id is null then
    select * into homeowner_row
    from public.homeowners
    where slug = p_homeowner_slug
    for update;
    if homeowner_row.id is null
      or lower(btrim(homeowner_row.full_name)) <> lower(btrim(p_homeowner_full_name))
      or coalesce(lower(btrim(homeowner_row.email)), '') <>
        coalesce(lower(btrim(p_homeowner_email)), '')
    then
      raise exception using message = 'Ambiguous Home Care Plan homeowner linkage requires review';
    end if;
    update public.homeowners
    set first_name = p_homeowner_first_name,
        phone = p_homeowner_phone,
        updated_at = now()
    where id = homeowner_row.id
    returning * into homeowner_row;
  end if;

  if exists (
    select 1
    from public.properties
    where authority_address_key = property_address_key
      and not (
        homeowner_id = homeowner_row.id
        and slug = p_property_slug
      )
  ) then
    raise exception using
      message = 'Ambiguous normalized property address requires review';
  end if;

  insert into public.properties (
    homeowner_id,
    slug,
    name,
    address,
    city,
    state,
    zip,
    type,
    hero_image,
    home_care_score,
    year_built,
    narrative,
    last_visit
  ) values (
    homeowner_row.id,
    p_property_slug,
    p_property_name,
    p_property_address,
    p_property_city,
    p_property_state,
    p_property_zip,
    p_property_type,
    p_property_hero_image,
    p_property_home_care_score,
    p_property_year_built,
    p_property_narrative,
    null
  )
  on conflict (homeowner_id, slug) do nothing
  returning * into property_row;

  if property_row.id is null then
    select * into property_row
    from public.properties
    where homeowner_id = homeowner_row.id and slug = p_property_slug
    for update;
    if property_row.id is null
      or lower(btrim(property_row.address)) <> lower(btrim(p_property_address))
    then
      raise exception using message = 'Ambiguous Home Care Plan property linkage requires review';
    end if;
    update public.properties
    set name = p_property_name,
        city = p_property_city,
        state = p_property_state,
        zip = p_property_zip,
        type = p_property_type,
        hero_image = p_property_hero_image,
        home_care_score = p_property_home_care_score,
        year_built = p_property_year_built,
        narrative = p_property_narrative,
        updated_at = now()
    where id = property_row.id
    returning * into property_row;
  end if;

  insert into public.home_care_plans (
    homeowner_id,
    property_id,
    homeowner_slug,
    property_slug,
    status,
    presentation,
    draft,
    storage_backend
  ) values (
    homeowner_row.id,
    property_row.id,
    p_homeowner_slug,
    p_property_slug,
    'generated',
    p_presentation,
    p_draft,
    'supabase'
  )
  on conflict (homeowner_slug, property_slug) do update set
    homeowner_id = excluded.homeowner_id,
    property_id = excluded.property_id,
    status = excluded.status,
    presentation = excluded.presentation,
    draft = excluded.draft,
    storage_backend = excluded.storage_backend,
    updated_at = now()
  returning * into plan_row;

  return plan_row;
end;
$$;

revoke all on function public.save_hq_home_care_plan(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, smallint, smallint, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_hq_home_care_plan(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, smallint, smallint, text, jsonb, jsonb
) to service_role;

comment on function public.save_hq_home_care_plan(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, smallint, smallint, text, jsonb, jsonb
) is 'Authenticated HQ Home Care Plan persistence; atomic and service-role-only.';

-- Establish one canonical signing time and signature fingerprint before any
-- storage write. Same-evidence retries share the attempt; conflicting evidence
-- is retained as a hold and cannot finalize.
create or replace function public.claim_presentation_signing_attempt(
  p_presentation_id uuid,
  p_attempt_id uuid,
  p_agreement_tier text,
  p_signature_sha256 text,
  p_presentation_authority_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  presentation_status text;
  attempt_row public.presentation_signing_attempts;
  claim_conflict boolean := false;
begin
  if p_agreement_tier not in ('biannual', 'quarterly')
    or p_signature_sha256 !~ '^[0-9a-f]{64}$'
    or p_presentation_authority_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception using message = 'Invalid presentation signing claim';
  end if;

  select status
  into presentation_status
  from public.presentations
  where id = p_presentation_id
  for update;

  if not found then
    raise exception using message = 'Presentation signing capability not found';
  end if;

  insert into public.presentation_signing_attempts (
    presentation_id,
    attempt_id,
    agreement_tier,
    signature_sha256,
    presentation_authority_sha256
  ) values (
    p_presentation_id,
    p_attempt_id,
    p_agreement_tier,
    p_signature_sha256,
    p_presentation_authority_sha256
  )
  on conflict (presentation_id) do nothing;

  select *
  into attempt_row
  from public.presentation_signing_attempts
  where presentation_id = p_presentation_id
  for update;

  if presentation_status = 'signed' and attempt_row.status <> 'complete' then
    update public.presentation_signing_attempts
    set status = 'held',
        conflict_count = conflict_count + 1,
        last_conflict_at = now(),
        last_conflict_reason = 'signed presentation has no completed signing attempt',
        updated_at = now()
    where presentation_id = p_presentation_id
    returning * into attempt_row;
  elsif attempt_row.agreement_tier <> p_agreement_tier
    or attempt_row.signature_sha256 <> p_signature_sha256
    or attempt_row.presentation_authority_sha256 <> p_presentation_authority_sha256
  then
    update public.presentation_signing_attempts
    set status = case when status = 'complete' then status else 'held' end,
        conflict_count = conflict_count + 1,
        last_conflict_at = now(),
        last_conflict_reason = 'conflicting tier or signature evidence',
        updated_at = now()
    where presentation_id = p_presentation_id
    returning * into attempt_row;
    claim_conflict := true;
  end if;

  return jsonb_build_object(
    'outcome', case
      when claim_conflict or attempt_row.status = 'held' then 'conflict'
      when attempt_row.status = 'complete' then 'complete'
      else 'claimed'
    end,
    'attempt_id', attempt_row.attempt_id,
    'agreement_tier', attempt_row.agreement_tier,
    'signature_sha256', attempt_row.signature_sha256,
    'presentation_authority_sha256', attempt_row.presentation_authority_sha256,
    'signed_at', attempt_row.signed_at,
    'agreement_id', attempt_row.agreement_id,
    'status', attempt_row.status
  );
end;
$$;

revoke all on function public.claim_presentation_signing_attempt(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_presentation_signing_attempt(
  uuid, uuid, text, text, text
) to service_role;

-- Atomically create the immutable agreement and link the membership,
-- presentation, and signing-attempt ledger. Storage is already verified and
-- every reference is checked against the claimed attempt before commit.
create or replace function public.finalize_presentation_signing_attempt(
  p_presentation_id uuid,
  p_attempt_id uuid,
  p_homeowner_id uuid,
  p_property_id uuid,
  p_membership_id uuid,
  p_homeowner_slug text,
  p_property_slug text,
  p_homeowner_name text,
  p_plan_id text,
  p_plan_name text,
  p_signature_image_url text,
  p_signature_storage_path text,
  p_pdf_storage_ref text,
  p_ip_address text,
  p_user_agent text,
  p_visit_price numeric,
  p_annual_rate numeric,
  p_enrollment_savings numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  attempt_row public.presentation_signing_attempts;
  presentation_row public.presentations;
  membership_row public.memberships;
  agreement_row public.signed_agreements;
begin
  select * into attempt_row
  from public.presentation_signing_attempts
  where presentation_id = p_presentation_id
    and attempt_id = p_attempt_id
  for update;

  if not found then
    raise exception using message = 'Signing attempt not found';
  end if;

  if attempt_row.status = 'complete' and attempt_row.agreement_id is not null then
    return jsonb_build_object(
      'outcome', 'replay',
      'agreement_id', attempt_row.agreement_id,
      'signed_at', attempt_row.signed_at
    );
  end if;

  if attempt_row.status <> 'pending' then
    return jsonb_build_object('outcome', 'held');
  end if;

  select * into presentation_row
  from public.presentations
  where id = p_presentation_id
  for update;

  select * into membership_row
  from public.memberships
  where id = p_membership_id
  for update;

  if presentation_row.id is null
    or presentation_row.status = 'signed'
    or presentation_row.authority_sha256 is distinct from attempt_row.presentation_authority_sha256
    or membership_row.id is null
    or membership_row.homeowner_id is distinct from p_homeowner_id
    or membership_row.property_id is distinct from p_property_id
    or membership_row.presentation_id is distinct from p_presentation_id
    or membership_row.sales_tier is distinct from attempt_row.agreement_tier
    or membership_row.visit_price is distinct from p_visit_price
    or membership_row.status is distinct from 'pending_payment'
  then
    update public.presentation_signing_attempts
    set status = 'held',
        conflict_count = conflict_count + 1,
        last_conflict_at = now(),
        last_conflict_reason = 'final linkage verification failed',
        updated_at = now()
    where presentation_id = p_presentation_id;
    return jsonb_build_object('outcome', 'held');
  end if;

  insert into public.signed_agreements (
    homeowner_id,
    property_id,
    membership_id,
    presentation_id,
    homeowner_slug,
    property_slug,
    homeowner_name,
    plan_id,
    plan_name,
    signature_method,
    signer_name,
    signature_image_url,
    signed_at,
    ip_address,
    user_agent,
    agreement_pdf_url,
    signature_image_storage_path,
    status,
    storage_backend,
    signing_attempt_id,
    signing_evidence_sha256,
    agreement_tier
  ) values (
    p_homeowner_id,
    p_property_id,
    p_membership_id,
    p_presentation_id,
    p_homeowner_slug,
    p_property_slug,
    p_homeowner_name,
    p_plan_id,
    p_plan_name,
    'drawn',
    p_homeowner_name,
    p_signature_image_url,
    attempt_row.signed_at,
    p_ip_address,
    p_user_agent,
    p_pdf_storage_ref,
    p_signature_storage_path,
    'complete',
    'supabase',
    p_attempt_id,
    attempt_row.signature_sha256,
    attempt_row.agreement_tier
  )
  returning * into agreement_row;

  update public.memberships
  set agreement_id = agreement_row.id,
      presentation_id = p_presentation_id,
      updated_at = now()
  where id = p_membership_id;

  update public.presentations
  set status = 'signed',
      signed_at = attempt_row.signed_at,
      agreement_id = agreement_row.id,
      homeowner_id = p_homeowner_id,
      property_id = p_property_id,
      membership_id = p_membership_id,
      onboarding_status = 'pending_payment',
      tier = attempt_row.agreement_tier,
      annual_rate = p_annual_rate,
      monthly_rate = 0,
      override_tier = null,
      visit_rate_overrides = '{}'::jsonb,
      enrollment_savings = p_enrollment_savings,
      updated_at = now()
  where id = p_presentation_id;

  update public.presentation_signing_attempts
  set status = 'complete',
      agreement_id = agreement_row.id,
      updated_at = now()
  where presentation_id = p_presentation_id;

  return jsonb_build_object(
    'outcome', 'complete',
    'agreement_id', agreement_row.id,
    'signed_at', attempt_row.signed_at
  );
end;
$$;

revoke all on function public.finalize_presentation_signing_attempt(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.finalize_presentation_signing_attempt(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, numeric, numeric, numeric
) to service_role;
