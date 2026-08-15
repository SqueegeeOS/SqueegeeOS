-- Owner-leverage operating system. This migration adds the two facts that
-- cannot be inferred safely from Jobber or membership records alone:
--   1. whether a completed normal visit genuinely ran without owner help;
--   2. how much deliberate growth time the team invested.
-- It does not send messages, mutate Jobber, issue compensation, or charge a card.

begin;

-- Reuse the signed-presentation attribution chain for the two current growth
-- operators. Historical closes are intentionally not relabeled; this ledger
-- starts cleanly when an operator opens a presentation through their profile.
insert into public.sales_reps (
  id,
  slug,
  display_name,
  role_title,
  status,
  compensation_plan,
  plan_status,
  benefit_profile
) values
  (
    '00000000-0000-4000-8000-000000000a01',
    'noah',
    'Noah Thomas',
    'Founder & Growth Operator',
    'active',
    'standard_commission',
    'draft_tracking_only',
    jsonb_build_object(
      'growth_operator', true,
      'owner', true,
      'compensation_tracking', false
    )
  ),
  (
    '00000000-0000-4000-8000-000000000a02',
    'dasan',
    'Dasan Gramps',
    'Co-Founder & Growth Operator',
    'active',
    'standard_commission',
    'draft_tracking_only',
    jsonb_build_object(
      'growth_operator', true,
      'owner', true,
      'compensation_tracking', false
    )
  )
on conflict (slug) do update
set display_name = excluded.display_name,
    role_title = excluded.role_title,
    status = excluded.status,
    benefit_profile = public.sales_reps.benefit_profile || excluded.benefit_profile;

create table if not exists public.growth_work_sessions (
  id uuid primary key,
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  business_date date not null,
  channel text not null check (
    channel in (
      'door_to_door',
      'google',
      'paid_ads',
      'past_customer_reactivation',
      'memberships',
      'referrals',
      'upsells',
      'local_partnerships',
      'other'
    )
  ),
  status text not null default 'open' check (
    status in ('open', 'completed', 'cancelled')
  ),
  started_at timestamptz not null,
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 240),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (notes is null or char_length(notes) <= 2000),
  check (
    (status = 'open' and ended_at is null and break_minutes = 0)
    or
    (status in ('completed', 'cancelled')
      and ended_at is not null
      and ended_at >= started_at
      and ended_at <= started_at + interval '16 hours')
  ),
  check (
    status <> 'completed'
    or extract(epoch from (ended_at - started_at)) / 60 > break_minutes
  )
);

create unique index if not exists growth_work_sessions_one_open_per_rep_uidx
  on public.growth_work_sessions(rep_id)
  where status = 'open';
create index if not exists growth_work_sessions_business_date_idx
  on public.growth_work_sessions(business_date desc, rep_id);
create index if not exists growth_work_sessions_rep_started_idx
  on public.growth_work_sessions(rep_id, started_at desc);

drop trigger if exists growth_work_sessions_updated_at
  on public.growth_work_sessions;
create trigger growth_work_sessions_updated_at
  before update on public.growth_work_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.field_independence_reviews (
  id uuid primary key,
  appointment_id uuid not null unique
    references public.member_appointments(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  external_visit_id text not null,
  service_date date not null,
  technician_jobber_user_id text not null,
  technician_display_name text not null,
  job_class text not null check (job_class in ('normal', 'exceptional')),
  owner_involvement text not null check (
    owner_involvement in ('none', 'remote_guidance', 'onsite_assist', 'owner_led')
  ),
  owner_minutes integer not null default 0 check (owner_minutes between 0 and 960),
  quality_outcome text not null check (
    quality_outcome in ('verified', 'follow_up', 'rework', 'safety_stop')
  ),
  production_minutes integer check (production_minutes between 1 and 960),
  duration_source text not null check (
    duration_source in ('field_events', 'jobber_schedule', 'unavailable')
  ),
  source_verified_at timestamptz,
  reviewed_by text not null,
  review_note text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(external_visit_id), '') is not null),
  check (char_length(external_visit_id) <= 255),
  check (nullif(trim(technician_jobber_user_id), '') is not null),
  check (char_length(technician_jobber_user_id) <= 255),
  check (nullif(trim(technician_display_name), '') is not null),
  check (char_length(technician_display_name) <= 80),
  check (nullif(trim(reviewed_by), '') is not null),
  check (char_length(reviewed_by) <= 80),
  check (review_note is null or char_length(review_note) <= 2000),
  check (
    (owner_involvement = 'none' and owner_minutes = 0)
    or
    (owner_involvement <> 'none' and owner_minutes > 0)
  ),
  check (
    (duration_source = 'unavailable' and production_minutes is null)
    or
    (duration_source <> 'unavailable' and production_minutes is not null)
  )
);

create index if not exists field_independence_reviews_service_date_idx
  on public.field_independence_reviews(service_date desc, technician_jobber_user_id);
create index if not exists field_independence_reviews_reviewed_at_idx
  on public.field_independence_reviews(reviewed_at desc);

drop trigger if exists field_independence_reviews_updated_at
  on public.field_independence_reviews;
create trigger field_independence_reviews_updated_at
  before update on public.field_independence_reviews
  for each row execute function public.set_updated_at();

alter table public.growth_work_sessions enable row level security;
alter table public.field_independence_reviews enable row level security;

revoke all privileges on table public.growth_work_sessions
  from public, anon, authenticated;
revoke all privileges on table public.field_independence_reviews
  from public, anon, authenticated;
grant select, insert, update, delete on table public.growth_work_sessions
  to service_role;
grant select, insert, update on table public.field_independence_reviews
  to service_role;

comment on table public.growth_work_sessions is
  'Private, exact-time growth-work ledger. A session records effort only and never manufactures a sales outcome.';
comment on table public.field_independence_reviews is
  'One HQ-reviewed independence outcome per verified Jobber appointment; only normal, verified, zero-owner-involvement rows can count toward owner time buyback.';

-- Extend the authoritative privacy posture as operator time and technician
-- performance join private customer operations.
create or replace function public.homeatlas_security_posture()
returns table(
  customer_public_policy_count bigint,
  customer_public_privilege_count bigint,
  admin_rate_limit_ready boolean
)
language sql
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
      ('presentations'),
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events'),
      ('customer_contact_consent_events'),
      ('customer_communication_provider_verifications'),
      ('google_business_connections'),
      ('sales_reps'),
      ('sales_rep_leads'),
      ('sales_rep_activity_events'),
      ('sales_rep_attributions'),
      ('member_profiles'),
      ('member_savings_transactions'),
      ('service_observations'),
      ('ai_quotes'),
      ('property_assessments'),
      ('property_visit_health_checks'),
      ('technician_access_grants'),
      ('technician_visit_events'),
      ('customer_aftercare_resolutions'),
      ('customer_service_cases'),
      ('growth_work_sessions'),
      ('field_independence_reviews')
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
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename in (select table_name from sensitive_tables)
        and (
          'anon' = any(policy.roles)
          or 'authenticated' = any(policy.roles)
          or 'public' = any(policy.roles)
        )
    ),
    (
      select count(*)
      from sensitive_tables sensitive
      cross join public_roles role
      cross join table_privileges privilege
      where has_table_privilege(
        role.role_name,
        format('public.%I', sensitive.table_name),
        privilege.privilege_name
      )
    ),
    to_regclass('public.admin_unlock_rate_limits') is not null;
$$;

revoke all on function public.homeatlas_security_posture()
  from public, anon, authenticated;
grant execute on function public.homeatlas_security_posture()
  to service_role;

commit;
