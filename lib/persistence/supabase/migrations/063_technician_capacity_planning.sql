-- Technician production-capacity planning.
--
-- Owner-declared capacity and planning labor cost are explicit assumptions,
-- never inferred from Jobber or treated as payroll truth. Rows are append-only
-- so later plans supersede earlier ones without erasing the decision history.
-- This migration does not schedule work, mutate Jobber, send messages, change
-- compensation, create invoices, or charge a card.

begin;

create table if not exists public.technician_capacity_plans (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  jobber_user_id text not null,
  display_name text not null,
  effective_week_start date not null,
  weekly_capacity_minutes integer not null check (
    weekly_capacity_minutes between 0 and 4800
  ),
  planning_hourly_cost_cents integer check (
    planning_hourly_cost_cents between 0 and 100000
  ),
  notes text,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (nullif(trim(jobber_user_id), '') is not null),
  check (char_length(jobber_user_id) <= 255),
  check (char_length(trim(display_name)) between 2 and 80),
  check (notes is null or char_length(notes) <= 1000),
  check (char_length(trim(recorded_by)) between 2 and 80),
  check (extract(isodow from effective_week_start) = 1)
);

create index if not exists technician_capacity_plans_effective_idx
  on public.technician_capacity_plans(
    jobber_user_id,
    effective_week_start desc,
    recorded_at desc
  );

alter table public.technician_capacity_plans enable row level security;

revoke all privileges on table public.technician_capacity_plans
  from public, anon, authenticated;

-- Append-only decision history: a newer effective plan supersedes the view,
-- while prior assumptions remain available for audit and comparison.
grant select, insert on table public.technician_capacity_plans
  to service_role;

comment on table public.technician_capacity_plans is
  'Append-only private owner assumptions for weekly technician capacity and optional planning labor cost. Not payroll, booked revenue, or gross profit.';
comment on column public.technician_capacity_plans.planning_hourly_cost_cents is
  'Optional owner-entered planning input. It is not a payroll record or proof of loaded labor cost.';

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
      ('technician_independent_day_trials'),
      ('technician_capacity_plans')
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
