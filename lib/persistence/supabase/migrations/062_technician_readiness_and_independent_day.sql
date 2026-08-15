-- Technician readiness and first independent-day evidence.
--
-- This migration records private HQ observations and deliberate trial dates.
-- A trial outcome is never stored as a manual "pass": HomeAtlas derives it
-- from the complete mirrored Jobber route, completed visits, field closeouts,
-- owner-involvement reviews, and unresolved service exceptions.
-- Nothing here sends a message, writes to Jobber, charges a card, or changes
-- compensation.

begin;

create table if not exists public.technician_competency_assessments (
  id uuid primary key default gen_random_uuid(),
  jobber_user_id text not null,
  display_name text not null,
  competency text not null check (
    competency in (
      'route_ownership',
      'scope_and_property_context',
      'equipment_and_setup',
      'safety_and_stop_work',
      'service_quality',
      'customer_handoff',
      'closeout_and_proof',
      'exception_escalation'
    )
  ),
  rating text not null check (
    rating in ('learning', 'supervised', 'independent')
  ),
  evidence_note text not null,
  source_appointment_id uuid
    references public.member_appointments(id) on delete set null,
  assessed_by text not null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (nullif(trim(jobber_user_id), '') is not null),
  check (char_length(jobber_user_id) <= 255),
  check (char_length(trim(display_name)) between 2 and 80),
  check (char_length(trim(evidence_note)) between 10 and 1000),
  check (char_length(trim(assessed_by)) between 2 and 80)
);

create index if not exists technician_competency_assessments_latest_idx
  on public.technician_competency_assessments(
    jobber_user_id,
    competency,
    assessed_at desc
  );
create index if not exists technician_competency_assessments_source_idx
  on public.technician_competency_assessments(source_appointment_id)
  where source_appointment_id is not null;

create table if not exists public.technician_independent_day_trials (
  id uuid primary key default gen_random_uuid(),
  jobber_user_id text not null,
  display_name text not null,
  trial_date date not null,
  status text not null default 'planned' check (
    status in ('planned', 'cancelled')
  ),
  plan_note text,
  planned_by text not null,
  planned_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(jobber_user_id), '') is not null),
  check (char_length(jobber_user_id) <= 255),
  check (char_length(trim(display_name)) between 2 and 80),
  check (char_length(trim(planned_by)) between 2 and 80),
  check (plan_note is null or char_length(plan_note) <= 1000),
  check (
    (
      status = 'planned'
      and cancelled_at is null
      and cancelled_by is null
      and cancellation_reason is null
    )
    or
    (
      status = 'cancelled'
      and cancelled_at is not null
      and char_length(trim(cancelled_by)) between 2 and 80
      and char_length(trim(cancellation_reason)) between 5 and 1000
    )
  )
);

-- Keep duplicate clicks from creating two trials for the same technician/day.
-- Historical trials remain immutable evidence, while a later date can still be
-- planned after the first trial has run.
create unique index if not exists technician_independent_day_trials_planned_date_uidx
  on public.technician_independent_day_trials(jobber_user_id, trial_date)
  where status = 'planned';
create index if not exists technician_independent_day_trials_date_idx
  on public.technician_independent_day_trials(trial_date desc, jobber_user_id);

drop trigger if exists technician_independent_day_trials_updated_at
  on public.technician_independent_day_trials;
create trigger technician_independent_day_trials_updated_at
  before update on public.technician_independent_day_trials
  for each row execute function public.set_updated_at();

alter table public.technician_competency_assessments enable row level security;
alter table public.technician_independent_day_trials enable row level security;

revoke all privileges on table public.technician_competency_assessments
  from public, anon, authenticated;
revoke all privileges on table public.technician_independent_day_trials
  from public, anon, authenticated;

-- Competency history is append-only. A newer observation supersedes an older
-- one in the UI, but the original fact cannot be rewritten or deleted.
grant select, insert on table public.technician_competency_assessments
  to service_role;
grant select, insert on table public.technician_independent_day_trials
  to service_role;
grant update (
  status,
  cancelled_at,
  cancelled_by,
  cancellation_reason
) on table public.technician_independent_day_trials to service_role;

comment on table public.technician_competency_assessments is
  'Append-only private HQ observations for technician readiness. Latest evidence is shown, but history is never averaged away or rewritten.';
comment on table public.technician_independent_day_trials is
  'Private planned technician trial dates. Outcomes are derived from complete Jobber and HomeAtlas evidence, never manually marked passed.';

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
      ('field_independence_reviews'),
      ('technician_competency_assessments'),
      ('technician_independent_day_trials')
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
