-- Durable, appointment-scoped technician route automation. These events are
-- HomeAtlas operational truth only: they never mutate Jobber and customer
-- alert text remains draft-only until a separate consent/provider gate sends it.

begin;

create table if not exists public.technician_visit_events (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  appointment_id uuid not null references public.member_appointments(id) on delete cascade,
  external_visit_id text not null,
  technician_access_grant_id uuid references public.technician_access_grants(id) on delete restrict,
  jobber_user_id text,
  actor_display_name text not null,
  actor_kind text not null check (actor_kind in ('technician', 'hq')),
  event_type text not null check (
    event_type in (
      'en_route',
      'arrived',
      'service_started',
      'service_completed',
      'departed'
    )
  ),
  source text not null check (source in ('field_action', 'closeout')),
  occurred_at timestamptz not null default now(),
  customer_alert_state text not null default 'not_applicable' check (
    customer_alert_state in ('not_applicable', 'draft_only')
  ),
  customer_alert_draft text,
  created_at timestamptz not null default now(),
  check (nullif(trim(external_visit_id), '') is not null),
  check (length(external_visit_id) <= 255),
  check (jobber_user_id is null or length(jobber_user_id) <= 255),
  check (nullif(trim(actor_display_name), '') is not null),
  check (length(actor_display_name) <= 80),
  check (
    (actor_kind = 'technician'
      and technician_access_grant_id is not null
      and nullif(trim(coalesce(jobber_user_id, '')), '') is not null)
    or
    (actor_kind = 'hq'
      and technician_access_grant_id is null
      and jobber_user_id is null)
  ),
  check (
    (customer_alert_state = 'not_applicable' and customer_alert_draft is null)
    or
    (customer_alert_state = 'draft_only'
      and nullif(trim(coalesce(customer_alert_draft, '')), '') is not null
      and length(customer_alert_draft) <= 500)
  )
);

create unique index if not exists technician_visit_events_stage_uidx
  on public.technician_visit_events(appointment_id, event_type);
create index if not exists technician_visit_events_appointment_timeline_idx
  on public.technician_visit_events(appointment_id, occurred_at desc);
create index if not exists technician_visit_events_grant_timeline_idx
  on public.technician_visit_events(technician_access_grant_id, occurred_at desc)
  where technician_access_grant_id is not null;

alter table public.technician_visit_events enable row level security;

revoke all privileges on table public.technician_visit_events
  from public, anon, authenticated;
grant select on table public.technician_visit_events to service_role;

create or replace function public.record_technician_visit_event(
  p_event_id uuid,
  p_property_id uuid,
  p_appointment_id uuid,
  p_grant_id uuid,
  p_jobber_user_id text,
  p_actor_display_name text,
  p_actor_kind text,
  p_event_type text,
  p_source text,
  p_customer_alert_state text,
  p_customer_alert_draft text
)
returns table(
  event_id uuid,
  event_type text,
  occurred_at timestamptz,
  customer_alert_prepared boolean,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_user_id text := nullif(trim(coalesce(p_jobber_user_id, '')), '');
  normalized_actor text := trim(coalesce(p_actor_display_name, ''));
  normalized_draft text := nullif(trim(coalesce(p_customer_alert_draft, '')), '');
  appointment_property_id uuid;
  appointment_provider text;
  appointment_external_id text;
  desired_stage_order integer;
  latest_stage_order integer := 0;
  resolved_event_id uuid;
  resolved_event_type text;
  resolved_occurred_at timestamptz;
  resolved_alert_prepared boolean;
begin
  if p_event_id is null
     or p_property_id is null
     or p_appointment_id is null
     or normalized_actor = ''
     or length(normalized_actor) > 80
     or p_actor_kind is null
     or p_actor_kind not in ('technician', 'hq')
     or p_event_type is null
     or p_event_type not in (
       'en_route', 'arrived', 'service_started', 'service_completed', 'departed'
     )
     or p_source is null
     or p_source not in ('field_action', 'closeout')
     or p_customer_alert_state is null
     or p_customer_alert_state not in ('not_applicable', 'draft_only') then
    raise exception 'Invalid technician route event';
  end if;

  if p_customer_alert_state = 'draft_only' then
    if p_event_type not in ('en_route', 'arrived', 'service_completed')
       or normalized_draft is null
       or length(normalized_draft) > 500 then
      raise exception 'Invalid draft-only customer alert';
    end if;
  elsif normalized_draft is not null then
    raise exception 'Customer alert draft requires draft_only state';
  end if;

  select appointment.property_id, appointment.provider, appointment.external_id
    into appointment_property_id, appointment_provider, appointment_external_id
  from public.member_appointments appointment
  where appointment.id = p_appointment_id;

  if appointment_property_id is null
     or appointment_property_id <> p_property_id
     or appointment_provider is distinct from 'jobber'
     or nullif(trim(coalesce(appointment_external_id, '')), '') is null then
    raise exception 'Appointment is not a verified Jobber stop for this property';
  end if;

  if p_actor_kind = 'technician' then
    if p_grant_id is null or normalized_user_id is null then
      raise exception 'Technician Field Pass identity is required';
    end if;
    if not exists (
      select 1
      from public.technician_access_grants grant_row
      where grant_row.id = p_grant_id
        and grant_row.status = 'active'
        and grant_row.session_expires_at > now()
        and grant_row.jobber_user_id = normalized_user_id
        and grant_row.display_name = normalized_actor
    ) then
      raise exception 'Technician Field Pass is no longer active';
    end if;
  elsif p_grant_id is not null or normalized_user_id is not null then
    raise exception 'HQ route events cannot impersonate a technician';
  end if;

  desired_stage_order := case p_event_type
    when 'en_route' then 1
    when 'arrived' then 2
    when 'service_started' then 3
    when 'service_completed' then 4
    when 'departed' then 5
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_appointment_id::text, 0));

  select coalesce(max(case event_row.event_type
      when 'en_route' then 1
      when 'arrived' then 2
      when 'service_started' then 3
      when 'service_completed' then 4
      when 'departed' then 5
    end), 0)
    into latest_stage_order
  from public.technician_visit_events event_row
  where event_row.appointment_id = p_appointment_id;

  if desired_stage_order < latest_stage_order then
    raise exception 'Technician route cannot move backwards';
  end if;

  if desired_stage_order = latest_stage_order then
    select event_row.id,
      event_row.event_type,
      event_row.occurred_at,
      event_row.customer_alert_state = 'draft_only'
      into resolved_event_id,
        resolved_event_type,
        resolved_occurred_at,
        resolved_alert_prepared
    from public.technician_visit_events event_row
    where event_row.appointment_id = p_appointment_id
      and event_row.event_type = p_event_type
    order by event_row.occurred_at desc
    limit 1;

    if resolved_event_id is null then
      raise exception 'Technician route stage is inconsistent';
    end if;
    return query select
      resolved_event_id,
      resolved_event_type,
      resolved_occurred_at,
      resolved_alert_prepared,
      true;
    return;
  end if;

  if p_source = 'closeout' then
    if p_event_type <> 'service_completed' or not exists (
      select 1
      from public.property_assessments assessment
      where assessment.visit_id = p_appointment_id
        and assessment.field_record_id = p_event_id
    ) then
      raise exception 'A saved closeout is required for closeout automation';
    end if;
  elsif desired_stage_order > latest_stage_order + 1
    and not (
      p_event_type = 'service_completed'
      and exists (
        select 1
        from public.property_assessments assessment
        where assessment.visit_id = p_appointment_id
          and assessment.field_record_id is not null
      )
    ) then
      raise exception 'Complete the prior technician route stage first';
  end if;

  if p_event_type = 'service_completed' and not exists (
    select 1
    from public.property_assessments assessment
    where assessment.visit_id = p_appointment_id
      and assessment.field_record_id is not null
  ) then
    raise exception 'Save the HomeAtlas closeout before completing service';
  end if;

  insert into public.technician_visit_events (
    id,
    property_id,
    appointment_id,
    external_visit_id,
    technician_access_grant_id,
    jobber_user_id,
    actor_display_name,
    actor_kind,
    event_type,
    source,
    customer_alert_state,
    customer_alert_draft
  )
  values (
    p_event_id,
    p_property_id,
    p_appointment_id,
    appointment_external_id,
    p_grant_id,
    normalized_user_id,
    normalized_actor,
    p_actor_kind,
    p_event_type,
    p_source,
    p_customer_alert_state,
    normalized_draft
  )
  returning technician_visit_events.id,
    technician_visit_events.event_type,
    technician_visit_events.occurred_at,
    technician_visit_events.customer_alert_state = 'draft_only'
  into resolved_event_id,
    resolved_event_type,
    resolved_occurred_at,
    resolved_alert_prepared;

  return query select
    resolved_event_id,
    resolved_event_type,
    resolved_occurred_at,
    resolved_alert_prepared,
    false;
end;
$$;

revoke all on function public.record_technician_visit_event(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_technician_visit_event(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text
) to service_role;

comment on table public.technician_visit_events is
  'Monotonic HomeAtlas technician route events tied to verified Jobber appointments. Alert text is draft-only and this table has no delivery side effect.';

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
      ('technician_visit_events')
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
