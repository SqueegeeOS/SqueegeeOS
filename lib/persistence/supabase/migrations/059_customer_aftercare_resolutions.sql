-- Customer aftercare resolution ledger.
--
-- Open review and annual-care opportunities are derived from authoritative
-- visit and membership records. This table stores only an explicit owner
-- disposition, so reading HQ never creates work or contacts a customer.

begin;

create table if not exists public.customer_aftercare_resolutions (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  task_type text not null check (
    task_type in ('review_opportunity', 'annual_care_checkin')
  ),
  homeowner_id uuid not null references public.homeowners(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  appointment_id uuid references public.member_appointments(id) on delete cascade,
  resolution text not null check (resolution in ('completed', 'dismissed')),
  outcome text not null check (
    outcome in (
      'review_requested',
      'already_reviewed',
      'not_appropriate',
      'checkin_completed',
      'not_needed'
    )
  ),
  note text,
  evidence jsonb not null default '{}'::jsonb,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_aftercare_task_key_check check (
    char_length(task_key) between 12 and 220
    and task_key ~ '^[a-z0-9][a-z0-9:_-]+$'
  ),
  constraint customer_aftercare_note_check check (
    note is null or char_length(note) <= 1000
  ),
  constraint customer_aftercare_recorded_by_check check (
    char_length(trim(recorded_by)) between 1 and 80
  ),
  constraint customer_aftercare_task_shape_check check (
    (task_type = 'review_opportunity' and appointment_id is not null)
    or
    (task_type = 'annual_care_checkin' and appointment_id is null)
  ),
  constraint customer_aftercare_outcome_check check (
    (
      task_type = 'review_opportunity'
      and outcome in ('review_requested', 'already_reviewed', 'not_appropriate')
    )
    or
    (
      task_type = 'annual_care_checkin'
      and outcome in ('checkin_completed', 'not_needed')
    )
  ),
  constraint customer_aftercare_resolution_outcome_check check (
    (
      resolution = 'completed'
      and outcome in ('review_requested', 'already_reviewed', 'checkin_completed')
    )
    or
    (
      resolution = 'dismissed'
      and outcome in ('not_appropriate', 'not_needed')
    )
  )
);

create index if not exists customer_aftercare_membership_idx
  on public.customer_aftercare_resolutions(membership_id, recorded_at desc);
create index if not exists customer_aftercare_appointment_idx
  on public.customer_aftercare_resolutions(appointment_id)
  where appointment_id is not null;

drop trigger if exists customer_aftercare_resolutions_updated_at
  on public.customer_aftercare_resolutions;
create trigger customer_aftercare_resolutions_updated_at
  before update on public.customer_aftercare_resolutions
  for each row execute function public.set_updated_at();

alter table public.customer_aftercare_resolutions enable row level security;

revoke all privileges on table public.customer_aftercare_resolutions
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.customer_aftercare_resolutions to service_role;

comment on table public.customer_aftercare_resolutions is
  'Explicit owner dispositions for deterministic review and annual-care opportunities. The table has no messaging side effect.';

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
      ('customer_aftercare_resolutions')
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
