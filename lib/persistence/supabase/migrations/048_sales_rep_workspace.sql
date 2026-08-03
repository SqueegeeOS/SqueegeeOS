-- Migration 048: private, reusable field-sales workspace with a David-only
-- founding compensation model. This migration tracks activity and eligibility;
-- it does not calculate, issue, or pay commission, residuals, or equity.

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  role_title text not null default 'Membership Advisor',
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  compensation_plan text not null default 'standard_commission'
    check (compensation_plan in ('founding_david', 'standard_commission')),
  plan_status text not null default 'draft_tracking_only'
    check (plan_status in ('draft_tracking_only', 'signed_agreement_on_file')),
  benefit_profile jsonb not null default '{}'::jsonb,
  started_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_reps_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint sales_reps_name_check
    check (char_length(btrim(display_name)) between 2 and 120),
  constraint sales_reps_david_benefits_check
    check (
      (slug = 'david' and compensation_plan = 'founding_david')
      or
      (slug <> 'david' and compensation_plan = 'standard_commission')
    )
);

drop trigger if exists sales_reps_updated_at on public.sales_reps;
create trigger sales_reps_updated_at
  before update on public.sales_reps
  for each row execute function public.set_updated_at();

create table if not exists public.sales_rep_leads (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  full_name text not null,
  property_address text not null,
  phone_normalized text,
  email_normalized text,
  status text not null default 'new'
    check (status in (
      'new', 'follow_up', 'presentation', 'considering', 'signed', 'won', 'lost'
    )),
  source text not null default 'door_to_door'
    check (source in ('door_to_door', 'referral', 'event', 'manual')),
  estimated_arr_cents integer not null default 0
    check (estimated_arr_cents between 0 and 100000000),
  next_follow_up_at timestamptz,
  notes text,
  sms_consent_status text not null default 'unknown'
    check (sms_consent_status in ('unknown', 'opted_in', 'opted_out')),
  sms_consent_recorded_at timestamptz,
  sms_consent_disclosure_version text,
  sms_consent_source_path text,
  email_consent_status text not null default 'unknown'
    check (email_consent_status in ('unknown', 'opted_in', 'opted_out')),
  email_consent_recorded_at timestamptz,
  converted_homeowner_id uuid references public.homeowners(id) on delete set null,
  converted_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_rep_leads_name_check
    check (char_length(btrim(full_name)) between 2 and 140),
  constraint sales_rep_leads_address_check
    check (char_length(btrim(property_address)) between 5 and 260),
  constraint sales_rep_leads_contact_check
    check (phone_normalized is not null or email_normalized is not null),
  constraint sales_rep_leads_phone_check
    check (phone_normalized is null or phone_normalized ~ '^\+[1-9][0-9]{7,14}$'),
  constraint sales_rep_leads_email_check
    check (email_normalized is null or char_length(email_normalized) between 5 and 320),
  constraint sales_rep_leads_notes_check
    check (notes is null or char_length(notes) <= 2000),
  constraint sales_rep_leads_sms_consent_evidence_check
    check (
      (
        sms_consent_status = 'unknown'
        and sms_consent_recorded_at is null
        and sms_consent_disclosure_version is null
        and sms_consent_source_path is null
      )
      or
      (
        sms_consent_status in ('opted_in', 'opted_out')
        and sms_consent_recorded_at is not null
      )
    ),
  constraint sales_rep_leads_email_consent_time_check
    check (
      (email_consent_status = 'unknown' and email_consent_recorded_at is null)
      or
      (email_consent_status in ('opted_in', 'opted_out') and email_consent_recorded_at is not null)
    )
);

create index if not exists sales_rep_leads_rep_follow_up_idx
  on public.sales_rep_leads(rep_id, next_follow_up_at, updated_at desc);
create index if not exists sales_rep_leads_rep_status_idx
  on public.sales_rep_leads(rep_id, status, created_at desc);

drop trigger if exists sales_rep_leads_updated_at on public.sales_rep_leads;
create trigger sales_rep_leads_updated_at
  before update on public.sales_rep_leads
  for each row execute function public.set_updated_at();

create table if not exists public.sales_rep_activity_events (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  lead_id uuid references public.sales_rep_leads(id) on delete set null,
  event_type text not null check (event_type in (
    'door_knock', 'conversation', 'presentation_started',
    'follow_up_scheduled', 'lead_captured', 'membership_signed'
  )),
  quantity integer not null default 1 check (quantity between 1 and 100),
  source_path text not null,
  safe_details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sales_rep_activity_source_path_check
    check (char_length(btrim(source_path)) between 2 and 300)
);

create index if not exists sales_rep_activity_rep_occurred_idx
  on public.sales_rep_activity_events(rep_id, occurred_at desc);
create index if not exists sales_rep_activity_lead_idx
  on public.sales_rep_activity_events(lead_id, occurred_at desc)
  where lead_id is not null;

create table if not exists public.sales_rep_attributions (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  lead_id uuid references public.sales_rep_leads(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete restrict,
  attributed_arr_cents integer not null default 0
    check (attributed_arr_cents between 0 and 100000000),
  qualification_status text not null default 'pending'
    check (qualification_status in ('pending', 'active', 'qualified', 'cancelled')),
  membership_started_at timestamptz,
  retention_qualifies_at timestamptz,
  qualified_at timestamptz,
  compensation_plan_snapshot text not null
    check (compensation_plan_snapshot in ('founding_david', 'standard_commission')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_rep_attributions_qualification_check
    check (
      qualification_status <> 'qualified'
      or (
        retention_qualifies_at is not null
        and qualified_at is not null
        and qualified_at >= retention_qualifies_at
      )
    )
);

create unique index if not exists sales_rep_attributions_membership_uidx
  on public.sales_rep_attributions(membership_id)
  where membership_id is not null;
create index if not exists sales_rep_attributions_rep_status_idx
  on public.sales_rep_attributions(rep_id, qualification_status, created_at desc);

drop trigger if exists sales_rep_attributions_updated_at
  on public.sales_rep_attributions;
create trigger sales_rep_attributions_updated_at
  before update on public.sales_rep_attributions
  for each row execute function public.set_updated_at();

insert into public.sales_reps (
  id,
  slug,
  display_name,
  role_title,
  status,
  compensation_plan,
  plan_status,
  benefit_profile
) values (
  '00000000-0000-4000-8000-000000000d01',
  'david',
  'David',
  'Founding Membership Advisor',
  'active',
  'founding_david',
  'draft_tracking_only',
  jsonb_build_object(
    'exclusive_to', 'david',
    'front_end_commission', true,
    'back_end_quality_commission', true,
    'residual_eligible_after_months', 12,
    'equity_modeling_requires_signed_legal_agreement', true,
    'equity_milestones', jsonb_build_array(
      jsonb_build_object('retained_members', 25, 'modeled_percent', 1),
      jsonb_build_object('retained_members', 50, 'modeled_percent', 2),
      jsonb_build_object('retained_members', 75, 'modeled_percent', 3),
      jsonb_build_object('retained_members', 100, 'modeled_percent', 4),
      jsonb_build_object('retained_members', 125, 'modeled_percent', 5)
    )
  )
)
on conflict (slug) do update
set display_name = excluded.display_name,
    role_title = excluded.role_title,
    status = excluded.status,
    compensation_plan = excluded.compensation_plan,
    plan_status = excluded.plan_status,
    benefit_profile = excluded.benefit_profile;

alter table public.sales_reps enable row level security;
alter table public.sales_rep_leads enable row level security;
alter table public.sales_rep_activity_events enable row level security;
alter table public.sales_rep_attributions enable row level security;

revoke all privileges on table public.sales_reps
  from public, anon, authenticated;
revoke all privileges on table public.sales_rep_leads
  from public, anon, authenticated;
revoke all privileges on table public.sales_rep_activity_events
  from public, anon, authenticated;
revoke all privileges on table public.sales_rep_attributions
  from public, anon, authenticated;

grant select, insert, update on table public.sales_reps to service_role;
grant select, insert, update, delete on table public.sales_rep_leads to service_role;
grant select, insert on table public.sales_rep_activity_events to service_role;
grant select, insert, update on table public.sales_rep_attributions to service_role;

comment on table public.sales_reps is
  'Private sales-representative identities and plan assignments; David founding benefits are explicitly non-inheritable';
comment on table public.sales_rep_leads is
  'Private D2D lead queue with auditable contact permission and next action';
comment on table public.sales_rep_activity_events is
  'Append-only field activity pulse for representative performance';
comment on table public.sales_rep_attributions is
  'Membership attribution and retention eligibility tracking; not a payout or equity issuance ledger';

-- Extend the authoritative privacy posture without changing the return shape
-- consumed by Production Health.
create or replace function public.homeatlas_security_posture()
returns table(
  customer_public_policy_count bigint,
  customer_public_privilege_count bigint,
  admin_rate_limit_ready boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sensitive_tables(table_name) as (
    values
      ('homeowners'),
      ('properties'),
      ('home_care_plans'),
      ('memberships'),
      ('signed_agreements'),
      ('property_assets'),
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events'),
      ('google_business_connections'),
      ('sales_reps'),
      ('sales_rep_leads'),
      ('sales_rep_activity_events'),
      ('sales_rep_attributions')
  ),
  public_roles(role_name) as (
    values ('anon'), ('authenticated')
  ),
  table_privileges(privilege_name) as (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  )
  select
    (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in (select table_name from sensitive_tables)
        and (
          'anon' = any(p.roles)
          or 'authenticated' = any(p.roles)
          or 'public' = any(p.roles)
        )
    ),
    (
      select count(*)
      from sensitive_tables t
      cross join public_roles r
      cross join table_privileges p
      where has_table_privilege(
        r.role_name,
        format('public.%I', t.table_name),
        p.privilege_name
      )
    ),
    to_regclass('public.admin_unlock_rate_limits') is not null;
$$;

revoke all on function public.homeatlas_security_posture()
  from public, anon, authenticated;
grant execute on function public.homeatlas_security_posture()
  to service_role;
