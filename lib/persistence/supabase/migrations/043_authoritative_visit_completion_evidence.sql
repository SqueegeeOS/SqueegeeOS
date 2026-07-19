-- Migration 043: supervised authoritative Jobber visit completion and text evidence.
--
-- This is a prerequisite-only contract. It confirms one already-approved
-- Jobber appointment from the latest complete PR2 source projection and stores
-- immutable HQ evidence. It never fulfills obligations, prices or bills work,
-- calls Stripe, changes membership/agreement truth, publishes Property Memory,
-- sends customer communication, or invokes AI.

create table if not exists public.jobber_visit_completion_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique
    references public.member_appointments(id) on delete restrict,
  classification_id uuid not null unique
    references public.jobber_visit_classifications(id) on delete restrict,
  projection_id uuid not null
    references public.jobber_visit_projections(id) on delete restrict,
  connection_id text not null
    references public.jobber_connections(id) on delete restrict,
  external_visit_id text not null,
  source_payload_hash text not null check (
    source_payload_hash ~ '^[0-9a-f]{64}$'
  ),
  source_observed_at timestamptz not null,
  prior_approved_source_payload_hash text not null check (
    prior_approved_source_payload_hash ~ '^[0-9a-f]{64}$'
  ),
  property_link_id uuid not null
    references public.jobber_property_links(id) on delete restrict,
  property_link_updated_at timestamptz not null,
  membership_id uuid not null
    references public.memberships(id) on delete restrict,
  property_id uuid not null
    references public.properties(id) on delete restrict,
  provider_visit_status text not null check (provider_visit_status = 'COMPLETED'),
  provider_is_complete boolean not null check (provider_is_complete = true),
  provider_completed_at timestamptz not null,
  actor_id uuid not null
    references public.hq_admin_users(user_id) on delete restrict,
  reason text not null check (
    nullif(pg_catalog.btrim(reason), '') is not null
    and pg_catalog.char_length(pg_catalog.btrim(reason)) <= 1000
  ),
  prior_approved_projection_snapshot jsonb not null,
  completion_projection_snapshot jsonb not null,
  confirmed_at timestamptz not null default pg_catalog.now(),
  check (nullif(pg_catalog.btrim(external_visit_id), '') is not null),
  check (source_payload_hash <> prior_approved_source_payload_hash)
);

create index if not exists jobber_visit_completion_events_property_idx
  on public.jobber_visit_completion_events(property_id, provider_completed_at desc);
create index if not exists jobber_visit_completion_events_membership_idx
  on public.jobber_visit_completion_events(membership_id, provider_completed_at desc);

create table if not exists public.visit_text_evidence (
  id uuid primary key,
  appointment_id uuid not null
    references public.member_appointments(id) on delete restrict,
  completion_event_id uuid not null
    references public.jobber_visit_completion_events(id) on delete restrict,
  property_id uuid not null
    references public.properties(id) on delete restrict,
  membership_id uuid not null
    references public.memberships(id) on delete restrict,
  actor_id uuid not null
    references public.hq_admin_users(user_id) on delete restrict,
  evidence_text text not null check (
    nullif(pg_catalog.btrim(evidence_text), '') is not null
    and pg_catalog.char_length(pg_catalog.btrim(evidence_text)) <= 4000
  ),
  recorded_at timestamptz not null default pg_catalog.now()
);

create index if not exists visit_text_evidence_appointment_idx
  on public.visit_text_evidence(appointment_id, recorded_at);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'jobber_visit_completion_events_membership_property_fkey'
  ) then
    alter table public.jobber_visit_completion_events
      add constraint jobber_visit_completion_events_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'visit_text_evidence_membership_property_fkey'
  ) then
    alter table public.visit_text_evidence
      add constraint visit_text_evidence_membership_property_fkey
      foreign key (membership_id, property_id)
      references public.memberships(id, property_id)
      on delete restrict;
  end if;
end;
$$;

alter table public.member_appointments
  drop constraint if exists member_appointments_jobber_authority_state_check,
  add constraint member_appointments_jobber_authority_state_check check (
    jobber_authority_state is null
    or jobber_authority_state in (
      'approved', 'pending_review', 'rejected', 'revoked', 'completed'
    )
  ),
  drop constraint if exists member_appointments_jobber_authority_binding_check,
  add constraint member_appointments_jobber_authority_binding_check check (
    jobber_authority_state not in ('approved', 'completed')
    or (
      provider = 'jobber'
      and nullif(pg_catalog.btrim(external_id), '') is not null
      and jobber_visit_classification_id is not null
      and jobber_connection_id is not null
      and jobber_projection_id is not null
      and jobber_property_link_id is not null
      and jobber_membership_id is not null
      and jobber_property_link_updated_at is not null
      and source_payload_hash is not null
      and matched_obligation_id is null
      and (
        (
          jobber_authority_state = 'approved'
          and status = 'scheduled'
          and completed_at is null
        )
        or (
          jobber_authority_state = 'completed'
          and status = 'completed'
          and completed_at is not null
        )
      )
    )
  );

create or replace function public.reject_authoritative_visit_evidence_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Authoritative visit completion and text evidence are append-only and immutable';
end;
$$;

drop trigger if exists jobber_visit_completion_events_immutable
  on public.jobber_visit_completion_events;
create trigger jobber_visit_completion_events_immutable
  before update or delete on public.jobber_visit_completion_events
  for each row execute function public.reject_authoritative_visit_evidence_change();

drop trigger if exists visit_text_evidence_immutable
  on public.visit_text_evidence;
create trigger visit_text_evidence_immutable
  before update or delete on public.visit_text_evidence
  for each row execute function public.reject_authoritative_visit_evidence_change();

create or replace function public.confirm_jobber_visit_completion(
  requested_appointment_id uuid,
  requested_projection_id uuid,
  requested_source_payload_hash text,
  requested_classification_id uuid,
  requested_classification_updated_at timestamptz,
  requested_property_link_updated_at timestamptz,
  requested_reason text,
  requested_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed_at timestamptz := pg_catalog.clock_timestamp();
  normalized_reason text := pg_catalog.btrim(requested_reason);
  actor_row public.hq_admin_users%rowtype;
  appointment_identity record;
  connection_row public.jobber_connections%rowtype;
  sync_lock_row public.jobber_schedule_sync_locks%rowtype;
  projection_row public.jobber_visit_projections%rowtype;
  link_row public.jobber_property_links%rowtype;
  membership_row public.memberships%rowtype;
  watermark_row public.jobber_schedule_sync_watermarks%rowtype;
  coverage_run_row public.jobber_schedule_sync_runs%rowtype;
  classification_row public.jobber_visit_classifications%rowtype;
  appointment_row public.member_appointments%rowtype;
  completion_row public.jobber_visit_completion_events%rowtype;
  latest_classification_event public.jobber_visit_classification_events%rowtype;
begin
  if requested_appointment_id is null
    or requested_projection_id is null
    or requested_classification_id is null
    or requested_actor_id is null
    or requested_source_payload_hash is null
    or requested_source_payload_hash !~ '^[0-9a-f]{64}$'
    or requested_classification_updated_at is null
    or requested_property_link_updated_at is null
    or nullif(pg_catalog.btrim(coalesce(requested_reason, '')), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(requested_reason)) > 1000
  then
    raise exception 'completion_invalid: invalid completion input';
  end if;

  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'completion_conflict: Headquarters actor is not active';
  end if;

  select appointment.jobber_connection_id as connection_id,
    appointment.jobber_projection_id as projection_id,
    appointment.jobber_property_link_id as property_link_id,
    appointment.jobber_membership_id as membership_id,
    appointment.jobber_visit_classification_id as classification_id
  into appointment_identity
  from public.member_appointments appointment
  where appointment.id = requested_appointment_id;
  if not found then
    raise exception 'completion_not_found: Appointment was not found';
  end if;
  if appointment_identity.connection_id is null
    or appointment_identity.projection_id is distinct from requested_projection_id
    or appointment_identity.classification_id is distinct from requested_classification_id
    or appointment_identity.property_link_id is null
    or appointment_identity.membership_id is null
  then
    raise exception 'completion_conflict: Appointment provider identity changed';
  end if;

  select * into connection_row
  from public.jobber_connections connection
  where connection.id = appointment_identity.connection_id
  for share;
  if not found
    or connection_row.id <> 'squeegeeking'
    or connection_row.status <> 'connected'
    or connection_row.graphql_version <> '2025-04-16'
  then
    raise exception 'completion_conflict: Jobber connection is not current and connected';
  end if;

  select * into sync_lock_row
  from public.jobber_schedule_sync_locks sync_lock
  where sync_lock.connection_id = appointment_identity.connection_id
  for update;
  if not found or sync_lock_row.active_run_id is not null then
    raise exception 'completion_conflict: Current Jobber coverage is not complete and stable';
  end if;
  changed_at := pg_catalog.clock_timestamp();

  select * into projection_row
  from public.jobber_visit_projections projection
  where projection.id = requested_projection_id
  for update;
  if not found then
    raise exception 'completion_not_found: Jobber visit projection was not found';
  end if;
  if projection_row.connection_id <> appointment_identity.connection_id
    or projection_row.source_payload_hash <> requested_source_payload_hash
  then
    raise exception 'completion_conflict: Jobber visit source changed';
  end if;
  if projection_row.visit_status <> 'COMPLETED'
    or projection_row.is_complete is distinct from true
    or projection_row.completed_at is null
    or projection_row.completed_at > changed_at
    or projection_row.completed_at > projection_row.source_observed_at
  then
    raise exception 'completion_conflict: Jobber completion state is missing, malformed, unknown, or contradictory';
  end if;

  select * into link_row
  from public.jobber_property_links property_link
  where property_link.id = appointment_identity.property_link_id
  for update;
  if not found then
    raise exception 'completion_not_found: Jobber property link was not found';
  end if;
  if link_row.link_state <> 'active'
    or link_row.updated_at <> requested_property_link_updated_at
    or link_row.connection_id <> projection_row.connection_id
    or link_row.external_property_id <> projection_row.external_property_id
    or link_row.membership_id <> appointment_identity.membership_id
  then
    raise exception 'completion_conflict: Jobber property link changed or was revoked';
  end if;

  select * into membership_row
  from public.memberships membership
  where membership.id = link_row.membership_id
    and membership.property_id = link_row.property_id
  for update;
  if not found then
    raise exception 'completion_conflict: Membership does not match the property';
  end if;
  if membership_row.status <> 'active'
    or membership_row.payment_setup_completed_at is null
    or membership_row.agreement_id is null
    or nullif(pg_catalog.btrim(coalesce(membership_row.sales_tier, '')), '') is null
    or membership_row.visit_price is null
    or not exists (
      select 1
      from public.properties property
      join public.signed_agreements agreement
        on agreement.id = membership_row.agreement_id
       and agreement.status = 'complete'
       and agreement.membership_id = membership_row.id
       and agreement.property_id = membership_row.property_id
       and agreement.homeowner_id = membership_row.homeowner_id
      where property.id = membership_row.property_id
        and property.homeowner_id = membership_row.homeowner_id
    )
  then
    raise exception 'completion_conflict: Membership is not strictly active at the exact property';
  end if;

  select * into watermark_row
  from public.jobber_schedule_sync_watermarks watermark
  where watermark.connection_id = projection_row.connection_id
  for update;
  if not found
    or watermark_row.covered_at < changed_at - pg_catalog.make_interval(mins => 30)
    or watermark_row.covered_at > changed_at
  then
    raise exception 'completion_conflict: Current Jobber coverage is not complete and fresh';
  end if;

  select * into coverage_run_row
  from public.jobber_schedule_sync_runs run
  where run.id = watermark_row.run_id;
  if not found
    or coverage_run_row.connection_id <> projection_row.connection_id
    or coverage_run_row.status <> 'complete'
    or coverage_run_row.graphql_version <> '2025-04-16'
    or coverage_run_row.completed_at is null
    or coverage_run_row.completed_at <> watermark_row.covered_at
    or coverage_run_row.window_start <> watermark_row.window_start
    or coverage_run_row.window_end <> watermark_row.window_end
    or (
      select latest.id
      from public.jobber_schedule_sync_runs latest
      where latest.connection_id = projection_row.connection_id
      order by latest.reservation_sequence desc
      limit 1
    ) is distinct from coverage_run_row.id
  then
    raise exception 'completion_conflict: Current Jobber coverage is partial, stale, or superseded';
  end if;

  if not exists (
    select 1
    from public.jobber_visit_source_observations observation
    where observation.run_id = watermark_row.run_id
      and observation.pass_number = 2
      and observation.external_visit_id = projection_row.external_visit_id
      and observation.source_payload_hash = projection_row.source_payload_hash
      and observation.source_observed_at = projection_row.source_observed_at
  ) then
    raise exception 'completion_conflict: Visit is not in the current coverage-proven manifest';
  end if;

  select * into classification_row
  from public.jobber_visit_classifications classification
  where classification.id = requested_classification_id
  for update;
  if not found then
    raise exception 'completion_not_found: Visit classification was not found';
  end if;

  select * into appointment_row
  from public.member_appointments appointment
  where appointment.id = requested_appointment_id
  for update;
  if not found then
    raise exception 'completion_not_found: Appointment was not found';
  end if;

  if classification_row.updated_at <> requested_classification_updated_at
    or classification_row.projection_id <> projection_row.id
    or classification_row.connection_id <> projection_row.connection_id
    or classification_row.external_visit_id <> projection_row.external_visit_id
    or classification_row.appointment_id <> appointment_row.id
    or classification_row.property_link_id <> link_row.id
    or classification_row.property_link_updated_at <> link_row.updated_at
    or classification_row.membership_id <> membership_row.id
    or classification_row.property_id <> membership_row.property_id
  then
    raise exception 'completion_conflict: Prior approved visit authority changed';
  end if;

  select * into completion_row
  from public.jobber_visit_completion_events completion
  where completion.appointment_id = appointment_row.id;
  if found then
    if appointment_row.status <> 'completed'
      or appointment_row.completed_at is distinct from completion_row.provider_completed_at
      or appointment_row.jobber_authority_state <> 'completed'
      or appointment_row.source_payload_hash is distinct from projection_row.source_payload_hash
      or appointment_row.source_observed_at is distinct from projection_row.source_observed_at
      or completion_row.classification_id <> classification_row.id
      or completion_row.projection_id <> projection_row.id
      or completion_row.connection_id <> projection_row.connection_id
      or completion_row.external_visit_id <> projection_row.external_visit_id
      or completion_row.source_payload_hash <> projection_row.source_payload_hash
      or completion_row.property_link_id <> link_row.id
      or completion_row.property_link_updated_at <> link_row.updated_at
      or completion_row.membership_id <> membership_row.id
      or completion_row.property_id <> membership_row.property_id
      or completion_row.actor_id <> requested_actor_id
      or completion_row.reason <> normalized_reason
    then
      raise exception 'completion_conflict: Existing completion evidence no longer matches authority';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'replay',
      'appointment_id', appointment_row.id,
      'completion_event_id', completion_row.id,
      'completed_at', completion_row.provider_completed_at,
      'actor_id', completion_row.actor_id
    );
  end if;

  if classification_row.classification_state <> 'pending_review'
    or classification_row.source_payload_hash = projection_row.source_payload_hash
  then
    raise exception 'completion_conflict: Prior approved visit authority changed';
  end if;

  select * into latest_classification_event
  from public.jobber_visit_classification_events event
  where event.classification_id = classification_row.id
  order by event.occurred_at desc, event.id desc
  limit 1;
  if not found
    or latest_classification_event.event_type <> 'source_invalidated'
    or latest_classification_event.appointment_id <> appointment_row.id
    or latest_classification_event.source_payload_hash <> classification_row.source_payload_hash
    or not exists (
      select 1
      from public.jobber_visit_classification_events approved
      where approved.classification_id = classification_row.id
        and approved.event_type = 'approved'
        and approved.appointment_id = appointment_row.id
        and approved.projection_id = classification_row.projection_id
        and approved.connection_id = classification_row.connection_id
        and approved.external_visit_id = classification_row.external_visit_id
        and approved.source_payload_hash = classification_row.source_payload_hash
        and approved.property_link_id = classification_row.property_link_id
        and approved.property_link_updated_at = classification_row.property_link_updated_at
        and approved.membership_id = classification_row.membership_id
        and approved.property_id = classification_row.property_id
    )
  then
    raise exception 'completion_conflict: Exact prior approval and source invalidation evidence is missing';
  end if;

  if appointment_row.provider <> 'jobber'
    or appointment_row.external_id <> projection_row.external_visit_id
    or appointment_row.property_id <> membership_row.property_id
    or appointment_row.jobber_visit_classification_id <> classification_row.id
    or appointment_row.jobber_connection_id <> projection_row.connection_id
    or appointment_row.jobber_projection_id <> projection_row.id
    or appointment_row.jobber_property_link_id <> link_row.id
    or appointment_row.jobber_membership_id <> membership_row.id
    or appointment_row.jobber_property_link_updated_at <> link_row.updated_at
    or appointment_row.source_payload_hash <> classification_row.source_payload_hash
    or appointment_row.source_observed_at <> classification_row.source_observed_at
    or appointment_row.provenance_state <> 'provider_imported'
    or appointment_row.verification_state <> 'pending_review'
    or appointment_row.match_state <> 'manual_review'
    or appointment_row.jobber_authority_state <> 'pending_review'
    or appointment_row.matched_obligation_id is not null
    or appointment_row.status <> 'scheduled'
    or appointment_row.completed_at is not null
  then
    raise exception 'completion_conflict: Authoritative appointment changed before confirmation';
  end if;

  update public.member_appointments
  set status = 'completed',
      completed_at = projection_row.completed_at,
      verification_state = 'verified',
      match_state = 'matched',
      jobber_authority_state = 'completed',
      source_payload_hash = projection_row.source_payload_hash,
      source_observed_at = projection_row.source_observed_at
  where id = appointment_row.id
  returning * into appointment_row;

  insert into public.jobber_visit_completion_events (
    appointment_id, classification_id, projection_id, connection_id,
    external_visit_id, source_payload_hash, source_observed_at,
    prior_approved_source_payload_hash, property_link_id,
    property_link_updated_at, membership_id, property_id,
    provider_visit_status, provider_is_complete, provider_completed_at,
    actor_id, reason, prior_approved_projection_snapshot,
    completion_projection_snapshot, confirmed_at
  ) values (
    appointment_row.id, classification_row.id, projection_row.id,
    projection_row.connection_id, projection_row.external_visit_id,
    projection_row.source_payload_hash, projection_row.source_observed_at,
    classification_row.source_payload_hash, link_row.id, link_row.updated_at,
    membership_row.id, membership_row.property_id,
    projection_row.visit_status, projection_row.is_complete,
    projection_row.completed_at, requested_actor_id,
    normalized_reason, classification_row.projection_snapshot,
    pg_catalog.to_jsonb(projection_row), changed_at
  ) returning * into completion_row;

  return pg_catalog.jsonb_build_object(
    'outcome', 'completed',
    'appointment_id', appointment_row.id,
    'completion_event_id', completion_row.id,
    'completed_at', completion_row.provider_completed_at,
    'actor_id', completion_row.actor_id
  );
end;
$$;

create or replace function public.append_visit_text_evidence(
  requested_evidence_id uuid,
  requested_appointment_id uuid,
  requested_evidence_text text,
  requested_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_row public.hq_admin_users%rowtype;
  appointment_identity record;
  appointment_row public.member_appointments%rowtype;
  completion_row public.jobber_visit_completion_events%rowtype;
  link_row public.jobber_property_links%rowtype;
  membership_row public.memberships%rowtype;
  evidence_row public.visit_text_evidence%rowtype;
begin
  if requested_evidence_id is null
    or requested_appointment_id is null
    or requested_actor_id is null
    or nullif(pg_catalog.btrim(coalesce(requested_evidence_text, '')), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(requested_evidence_text)) > 4000
  then
    raise exception 'visit_evidence_invalid: invalid text evidence input';
  end if;

  select * into actor_row
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active = true
    and actor.role in ('owner', 'operator')
  for share;
  if not found then
    raise exception 'visit_evidence_conflict: Headquarters actor is not active';
  end if;

  -- Read only lock-routing identity first. Property-link revocation and
  -- completion both lock link -> membership -> appointment, so text evidence
  -- must not introduce the reverse appointment -> link edge.
  select appointment.jobber_property_link_id as property_link_id,
    appointment.jobber_membership_id as membership_id,
    appointment.property_id as property_id
  into appointment_identity
  from public.member_appointments appointment
  where appointment.id = requested_appointment_id;
  if not found then
    raise exception 'visit_evidence_not_found: Appointment was not found';
  end if;
  if appointment_identity.membership_id is null
    or appointment_identity.property_link_id is null
  then
    raise exception 'visit_evidence_conflict: Appointment authority identity is incomplete';
  end if;

  select * into link_row
  from public.jobber_property_links property_link
  where property_link.id = appointment_identity.property_link_id
  for share;
  if not found
    or link_row.link_state <> 'active'
    or link_row.membership_id <> appointment_identity.membership_id
    or link_row.property_id <> appointment_identity.property_id
  then
    raise exception 'visit_evidence_conflict: Completion property link changed or was revoked';
  end if;

  select * into membership_row
  from public.memberships membership
  where membership.id = appointment_identity.membership_id
    and membership.property_id = appointment_identity.property_id
  for share;
  if not found
    or membership_row.status <> 'active'
    or membership_row.payment_setup_completed_at is null
    or membership_row.agreement_id is null
    or nullif(pg_catalog.btrim(coalesce(membership_row.sales_tier, '')), '') is null
    or membership_row.visit_price is null
    or not exists (
      select 1
      from public.properties property
      join public.signed_agreements agreement
        on agreement.id = membership_row.agreement_id
       and agreement.status = 'complete'
       and agreement.membership_id = membership_row.id
       and agreement.property_id = membership_row.property_id
       and agreement.homeowner_id = membership_row.homeowner_id
      where property.id = membership_row.property_id
        and property.homeowner_id = membership_row.homeowner_id
    )
  then
    raise exception 'visit_evidence_conflict: Membership is not strictly active at the exact property';
  end if;

  select * into appointment_row
  from public.member_appointments appointment
  where appointment.id = requested_appointment_id
  for update;
  if not found
    or appointment_row.status <> 'completed'
    or appointment_row.completed_at is null
    or appointment_row.jobber_authority_state <> 'completed'
    or appointment_row.jobber_membership_id <> membership_row.id
    or appointment_row.jobber_property_link_id <> link_row.id
    or appointment_row.property_id <> membership_row.property_id
  then
    raise exception 'visit_evidence_conflict: Appointment is not authoritatively completed';
  end if;

  select * into completion_row
  from public.jobber_visit_completion_events completion
  where completion.appointment_id = appointment_row.id;
  if not found
    or completion_row.membership_id <> membership_row.id
    or completion_row.property_id <> membership_row.property_id
    or completion_row.property_link_id <> link_row.id
    or completion_row.property_link_updated_at <> link_row.updated_at
    or completion_row.provider_completed_at <> appointment_row.completed_at
  then
    raise exception 'visit_evidence_conflict: Completion authority evidence is missing or changed';
  end if;

  select * into evidence_row
  from public.visit_text_evidence evidence
  where evidence.id = requested_evidence_id;
  if found then
    if evidence_row.appointment_id <> appointment_row.id
      or evidence_row.completion_event_id <> completion_row.id
      or evidence_row.property_id <> completion_row.property_id
      or evidence_row.membership_id <> completion_row.membership_id
      or evidence_row.actor_id <> requested_actor_id
      or evidence_row.evidence_text <> pg_catalog.btrim(requested_evidence_text)
    then
      raise exception 'visit_evidence_conflict: Evidence id was already used for different evidence';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'replay',
      'evidence_id', evidence_row.id,
      'appointment_id', evidence_row.appointment_id,
      'recorded_at', evidence_row.recorded_at
    );
  end if;

  insert into public.visit_text_evidence (
    id, appointment_id, completion_event_id, property_id, membership_id,
    actor_id, evidence_text
  ) values (
    requested_evidence_id, appointment_row.id, completion_row.id,
    completion_row.property_id, completion_row.membership_id,
    requested_actor_id, pg_catalog.btrim(requested_evidence_text)
  ) returning * into evidence_row;

  return pg_catalog.jsonb_build_object(
    'outcome', 'recorded',
    'evidence_id', evidence_row.id,
    'appointment_id', evidence_row.appointment_id,
    'recorded_at', evidence_row.recorded_at
  );
end;
$$;

alter table public.jobber_visit_completion_events enable row level security;
alter table public.visit_text_evidence enable row level security;

revoke all on table public.jobber_visit_completion_events,
  public.visit_text_evidence
from public, anon, authenticated, service_role;
grant select on table public.jobber_visit_completion_events,
  public.visit_text_evidence
to service_role;

revoke all on function public.confirm_jobber_visit_completion(
  uuid, uuid, text, uuid, timestamptz, timestamptz, text, uuid
) from public, anon, authenticated;
revoke all on function public.append_visit_text_evidence(
  uuid, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.reject_authoritative_visit_evidence_change()
from public, anon, authenticated, service_role;

grant execute on function public.confirm_jobber_visit_completion(
  uuid, uuid, text, uuid, timestamptz, timestamptz, text, uuid
) to service_role;
grant execute on function public.append_visit_text_evidence(
  uuid, uuid, text, uuid
) to service_role;

comment on table public.jobber_visit_completion_events is
  'Immutable supervised HQ confirmation of exact Jobber completion truth. No obligation, billing, customer-publication, or AI authority.';
comment on table public.visit_text_evidence is
  'Immutable authenticated HQ text evidence derived server-side from one authoritatively completed appointment.';
