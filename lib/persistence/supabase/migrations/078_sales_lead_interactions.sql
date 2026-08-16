-- Migration 078: append-only CRM memory for manual lead follow-ups.
-- Recording an outcome atomically advances the private lead queue, but never
-- calls, emails, texts, enrolls, schedules, bills, or charges a customer.

begin;

create table if not exists public.sales_rep_lead_interactions (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  lead_id uuid not null,
  client_event_id uuid not null,
  recorded_by text not null check (recorded_by in ('owner', 'sales_rep')),
  channel text not null check (channel in ('call', 'email', 'sms', 'in_person')),
  outcome text not null check (outcome in (
    'no_answer',
    'spoke_follow_up',
    'presentation_scheduled',
    'not_interested'
  )),
  note text,
  previous_status text not null check (previous_status in (
    'new', 'follow_up', 'presentation', 'considering'
  )),
  resulting_status text not null check (resulting_status in (
    'follow_up', 'presentation', 'considering', 'lost'
  )),
  previous_next_follow_up_at timestamptz,
  next_follow_up_at timestamptz,
  expected_lead_updated_at timestamptz not null,
  source_path text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sales_rep_lead_interactions_lead_owner_fkey
    foreign key (lead_id, rep_id)
    references public.sales_rep_leads(id, rep_id)
    on delete restrict,
  constraint sales_rep_lead_interactions_note_check
    check (note is null or char_length(note) <= 1200),
  constraint sales_rep_lead_interactions_source_path_check
    check (char_length(btrim(source_path)) between 2 and 300),
  constraint sales_rep_lead_interactions_transition_check
    check (
      (
        outcome = 'no_answer'
        and resulting_status = 'follow_up'
        and next_follow_up_at is not null
      )
      or (
        outcome = 'spoke_follow_up'
        and resulting_status = 'considering'
        and next_follow_up_at is not null
      )
      or (
        outcome = 'presentation_scheduled'
        and resulting_status = 'presentation'
        and next_follow_up_at is not null
      )
      or (
        outcome = 'not_interested'
        and resulting_status = 'lost'
        and next_follow_up_at is null
        and char_length(btrim(coalesce(note, ''))) between 3 and 1200
      )
    )
);

create unique index if not exists sales_rep_lead_interactions_rep_client_uidx
  on public.sales_rep_lead_interactions(rep_id, client_event_id);
create index if not exists sales_rep_lead_interactions_lead_recent_idx
  on public.sales_rep_lead_interactions(lead_id, rep_id, occurred_at desc, id desc);

-- The trigger is the single transition boundary. An advisory transaction lock
-- serializes weak-network retries before any lead row can be changed.
create or replace function public.homeatlas_record_sales_lead_interaction()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  lead_record record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.rep_id::text || ':' || new.client_event_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.sales_rep_lead_interactions existing
    where existing.rep_id = new.rep_id
      and existing.client_event_id = new.client_event_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This lead interaction was already recorded.';
  end if;

  select
    lead.status,
    lead.next_follow_up_at,
    lead.updated_at
  into lead_record
  from public.sales_rep_leads lead
  where lead.id = new.lead_id
    and lead.rep_id = new.rep_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'That lead is not owned by this sales representative.';
  end if;

  if lead_record.status not in ('new', 'follow_up', 'presentation', 'considering') then
    raise exception using
      errcode = '23514',
      message = 'Completed sales outcomes cannot receive a follow-up interaction.';
  end if;

  if new.expected_lead_updated_at is distinct from lead_record.updated_at then
    raise exception using
      errcode = '40001',
      message = 'That lead changed in another session. Refresh before recording the outcome.';
  end if;

  if new.recorded_by not in ('owner', 'sales_rep') then
    raise exception using
      errcode = '23514',
      message = 'Choose who recorded this interaction.';
  end if;

  if new.channel not in ('call', 'email', 'sms', 'in_person') then
    raise exception using
      errcode = '23514',
      message = 'Choose how the interaction happened.';
  end if;

  new.note := nullif(btrim(coalesce(new.note, '')), '');
  new.source_path := btrim(new.source_path);
  new.previous_status := lead_record.status;
  new.previous_next_follow_up_at := lead_record.next_follow_up_at;
  new.occurred_at := clock_timestamp();
  new.created_at := new.occurred_at;

  new.resulting_status := case new.outcome
    when 'no_answer' then 'follow_up'
    when 'spoke_follow_up' then 'considering'
    when 'presentation_scheduled' then 'presentation'
    when 'not_interested' then 'lost'
    else null
  end;

  if new.resulting_status is null then
    raise exception using
      errcode = '23514',
      message = 'Choose a supported follow-up outcome.';
  end if;

  if new.outcome = 'not_interested' then
    if char_length(coalesce(new.note, '')) < 3 then
      raise exception using
        errcode = '23514',
        message = 'Add a short reason before closing this lead.';
    end if;
    new.next_follow_up_at := null;
  elsif new.next_follow_up_at is null
     or new.next_follow_up_at <= new.occurred_at
     or new.next_follow_up_at > new.occurred_at + interval '1 year' then
    raise exception using
      errcode = '23514',
      message = 'Choose a future next action within one year.';
  end if;

  update public.sales_rep_leads lead
  set status = new.resulting_status,
      next_follow_up_at = new.next_follow_up_at,
      notes = coalesce(new.note, lead.notes)
  where lead.id = new.lead_id
    and lead.rep_id = new.rep_id;

  return new;
end;
$$;

drop trigger if exists sales_rep_lead_interactions_record
  on public.sales_rep_lead_interactions;
create trigger sales_rep_lead_interactions_record
  before insert on public.sales_rep_lead_interactions
  for each row execute function public.homeatlas_record_sales_lead_interaction();

alter table public.sales_rep_lead_interactions enable row level security;

revoke all privileges on table public.sales_rep_lead_interactions
  from public, anon, authenticated, service_role;
grant select, insert on table public.sales_rep_lead_interactions
  to service_role;

revoke all on function public.homeatlas_record_sales_lead_interaction()
  from public, anon, authenticated, service_role;

comment on table public.sales_rep_lead_interactions is
  'Append-only record of manual sales follow-up outcomes; inserting records history and atomically sets the next action without sending communication';
comment on column public.sales_rep_lead_interactions.client_event_id is
  'Device-generated UUID that makes a manual outcome safe to retry';
comment on column public.sales_rep_lead_interactions.expected_lead_updated_at is
  'Optimistic-concurrency proof preventing a stale phone or HQ tab from overwriting a newer next action';

-- Keep the private-customer posture probe aware of follow-up notes and history.
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
      ('sales_rep_lead_interactions'),
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
