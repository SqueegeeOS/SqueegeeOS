-- Customer-reported service cases.
--
-- A portal token is verified by a server route before any insert or read. The
-- server derives every customer identifier; the browser supplies only the
-- issue, an optional visit, and an idempotency UUID. Owner notes stay private.

begin;

create table if not exists public.customer_service_cases (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  homeowner_id uuid not null references public.homeowners(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  appointment_id uuid references public.member_appointments(id) on delete set null,
  client_request_id uuid not null,
  category text not null check (
    category in (
      'service_quality',
      'damage_concern',
      'access_issue',
      'billing_question',
      'scheduling_question',
      'other'
    )
  ),
  details text not null,
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved', 'dismissed')
  ),
  source text not null default 'member_portal' check (
    source = 'member_portal'
  ),
  owner_note text,
  handled_by text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_service_cases_idempotency_unique unique (
    membership_id,
    client_request_id
  ),
  constraint customer_service_cases_details_check check (
    char_length(trim(details)) between 10 and 2000
  ),
  constraint customer_service_cases_owner_note_check check (
    owner_note is null or char_length(owner_note) <= 1000
  ),
  constraint customer_service_cases_handled_by_check check (
    handled_by is null or char_length(trim(handled_by)) between 1 and 80
  ),
  constraint customer_service_cases_resolution_shape_check check (
    (
      status = 'open'
      and acknowledged_at is null
      and resolved_at is null
    )
    or
    (
      status = 'acknowledged'
      and acknowledged_at is not null
      and resolved_at is null
      and handled_by is not null
    )
    or
    (
      status in ('resolved', 'dismissed')
      and acknowledged_at is not null
      and resolved_at is not null
      and handled_by is not null
    )
  )
);

create index if not exists customer_service_cases_open_idx
  on public.customer_service_cases(status, created_at)
  where status in ('open', 'acknowledged');
create index if not exists customer_service_cases_membership_idx
  on public.customer_service_cases(membership_id, created_at desc);
create index if not exists customer_service_cases_appointment_idx
  on public.customer_service_cases(appointment_id)
  where appointment_id is not null;

drop trigger if exists customer_service_cases_updated_at
  on public.customer_service_cases;
create trigger customer_service_cases_updated_at
  before update on public.customer_service_cases
  for each row execute function public.set_updated_at();

alter table public.customer_service_cases enable row level security;

revoke all privileges on table public.customer_service_cases
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.customer_service_cases to service_role;

comment on table public.customer_service_cases is
  'Private, token-authorized member service concerns and explicit HQ handling state. No row mutation sends a message.';
comment on column public.customer_service_cases.owner_note is
  'Private operator context. Never returned by a member portal API.';

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
      ('customer_service_cases')
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
