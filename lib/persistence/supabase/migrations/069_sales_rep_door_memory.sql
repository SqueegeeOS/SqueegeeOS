-- Migration 069: private, address-level doorstep memory for the reusable sales
-- workspace. Door outcomes are attached to a real door_knock event and remain
-- safe to retry from a weak-network field device. This does not contact a
-- homeowner, create a customer, or trigger billing.

begin;

-- Composite ownership keys let the database prove that a door activity and an
-- optional lead belong to the same representative as the memory record.
create unique index if not exists sales_rep_activity_id_rep_uidx
  on public.sales_rep_activity_events(id, rep_id);

create table if not exists public.sales_rep_door_visits (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  door_activity_id uuid not null,
  lead_id uuid,
  client_event_id uuid not null,
  property_address text not null,
  address_key text not null,
  disposition text not null check (disposition in (
    'not_home',
    'conversation',
    'follow_up',
    'interested',
    'not_interested',
    'do_not_knock'
  )),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sales_rep_door_visits_activity_owner_fkey
    foreign key (door_activity_id, rep_id)
    references public.sales_rep_activity_events(id, rep_id)
    on delete restrict,
  constraint sales_rep_door_visits_lead_owner_fkey
    foreign key (lead_id, rep_id)
    references public.sales_rep_leads(id, rep_id)
    on delete restrict,
  constraint sales_rep_door_visits_address_check
    check (char_length(btrim(property_address)) between 5 and 260),
  constraint sales_rep_door_visits_address_key_check
    check (char_length(btrim(address_key)) between 3 and 260),
  constraint sales_rep_door_visits_notes_check
    check (notes is null or char_length(notes) <= 1200)
);

create unique index if not exists sales_rep_door_visits_activity_uidx
  on public.sales_rep_door_visits(door_activity_id, rep_id);
create unique index if not exists sales_rep_door_visits_rep_client_event_uidx
  on public.sales_rep_door_visits(rep_id, client_event_id);
create index if not exists sales_rep_door_visits_rep_occurred_idx
  on public.sales_rep_door_visits(rep_id, occurred_at desc);
create index if not exists sales_rep_door_visits_rep_address_idx
  on public.sales_rep_door_visits(rep_id, address_key, occurred_at desc);
create index if not exists sales_rep_door_visits_lead_idx
  on public.sales_rep_door_visits(lead_id, rep_id, occurred_at desc)
  where lead_id is not null;

-- A memory may only describe an active door_knock owned by the same rep. The
-- activity timestamp is authoritative even if a device clock drifts.
create or replace function public.homeatlas_validate_sales_rep_door_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_record record;
begin
  select event_type, occurred_at, reversed_at
    into activity_record
  from public.sales_rep_activity_events
  where id = new.door_activity_id
    and rep_id = new.rep_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Door memory requires an owned field activity.';
  end if;

  if activity_record.event_type <> 'door_knock' then
    raise exception using
      errcode = '23514',
      message = 'Door memory requires a door_knock activity.';
  end if;

  if activity_record.reversed_at is not null then
    raise exception using
      errcode = '23514',
      message = 'A corrected door activity cannot receive memory.';
  end if;

  new.occurred_at := activity_record.occurred_at;
  return new;
end;
$$;

drop trigger if exists sales_rep_door_visits_validate_activity
  on public.sales_rep_door_visits;
create trigger sales_rep_door_visits_validate_activity
  before insert or update on public.sales_rep_door_visits
  for each row execute function public.homeatlas_validate_sales_rep_door_visit();

-- Once an outcome is attached, the underlying knock remains an immutable part
-- of that address history instead of becoming an orphaned reversed event.
create or replace function public.homeatlas_protect_mapped_door_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reversed_at is null
     and new.reversed_at is not null
     and exists (
       select 1
       from public.sales_rep_door_visits visit
       where visit.door_activity_id = old.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'A door activity with saved address memory cannot be reversed.';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_rep_activity_protect_door_memory
  on public.sales_rep_activity_events;
create trigger sales_rep_activity_protect_door_memory
  before update of reversed_at on public.sales_rep_activity_events
  for each row execute function public.homeatlas_protect_mapped_door_activity();

alter table public.sales_rep_door_visits enable row level security;

revoke all privileges on table public.sales_rep_door_visits
  from public, anon, authenticated, service_role;
grant select, insert on table public.sales_rep_door_visits
  to service_role;
grant update (lead_id) on table public.sales_rep_door_visits
  to service_role;

revoke all on function public.homeatlas_validate_sales_rep_door_visit()
  from public, anon, authenticated;
revoke all on function public.homeatlas_protect_mapped_door_activity()
  from public, anon, authenticated;

comment on table public.sales_rep_door_visits is
  'Private address-level D2D outcomes tied to immutable owned door activity; no messaging or billing side effect';
comment on column public.sales_rep_door_visits.client_event_id is
  'Device-generated UUID that makes weak-network door-memory retries idempotent';
comment on column public.sales_rep_door_visits.address_key is
  'Server-normalized comparison key used to find prior history at the same address';

-- Keep Production Health's authoritative privacy probe aware of the new table.
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
      ('sales_rep_door_visits'),
      ('sales_rep_attributions'),
      ('sales_rep_access_grants'),
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
      ('technician_capacity_plans'),
      ('member_addon_transactions'),
      ('agreement_document_versions'),
      ('enrollment_packets'),
      ('enrollment_packet_events'),
      ('membership_payment_handoffs'),
      ('membership_payment_handoff_events')
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
