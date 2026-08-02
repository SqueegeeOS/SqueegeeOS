-- Fail-closed communications hardening.
-- Run after 044_sms_consent_evidence.sql.

create table if not exists public.customer_communication_provider_verifications (
  provider text primary key check (provider in ('resend', 'twilio')),
  webhook_verified_at timestamptz not null,
  webhook_secret_fingerprint text not null
    check (webhook_secret_fingerprint ~ '^[0-9a-f]{64}$'),
  last_event_type text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists customer_communication_provider_verifications_updated_at
  on public.customer_communication_provider_verifications;
create trigger customer_communication_provider_verifications_updated_at
  before update on public.customer_communication_provider_verifications
  for each row execute function public.set_updated_at();

create table if not exists public.customer_contact_consent_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.customer_conversations(id) on delete restrict,
  contact_point_id uuid not null
    references public.customer_contact_points(id) on delete restrict,
  homeowner_id uuid not null references public.homeowners(id) on delete restrict,
  channel text not null default 'sms' check (channel = 'sms'),
  address_normalized text not null
    check (address_normalized ~ '^\+[1-9][0-9]{7,14}$'),
  prior_status text not null
    check (prior_status in ('unknown', 'opted_in', 'opted_out')),
  next_status text not null
    check (next_status in ('opted_in', 'opted_out')),
  evidence_kind text not null check (
    evidence_kind in (
      'founder_attested_explicit_consent',
      'founder_recorded_customer_opt_out'
    )
  ),
  evidence_note text not null
    check (char_length(evidence_note) between 8 and 1000),
  disclosure_version text,
  recorded_by text not null check (char_length(recorded_by) between 2 and 120),
  source_path text not null,
  request_ip text,
  user_agent text,
  idempotency_key text not null unique
    check (char_length(idempotency_key) between 12 and 200),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_contact_consent_events_contact_idx
  on public.customer_contact_consent_events(contact_point_id, recorded_at desc);
create index if not exists customer_contact_consent_events_homeowner_idx
  on public.customer_contact_consent_events(homeowner_id, recorded_at desc);

create or replace function public.reject_customer_contact_consent_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Customer contact consent evidence is append-only';
end;
$$;

drop trigger if exists customer_contact_consent_events_immutable
  on public.customer_contact_consent_events;
create trigger customer_contact_consent_events_immutable
  before update or delete on public.customer_contact_consent_events
  for each row execute function public.reject_customer_contact_consent_event_mutation();

create or replace function public.record_hq_sms_consent_decision(
  p_conversation_id uuid,
  p_address_normalized text,
  p_next_status text,
  p_evidence_note text,
  p_attested boolean,
  p_recorded_by text,
  p_source_path text,
  p_request_ip text,
  p_user_agent text,
  p_idempotency_key text
)
returns table (
  contact_point_id uuid,
  consent_status text,
  verification_status text,
  consent_recorded_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_homeowner_id uuid;
  v_contact_point_id uuid;
  v_prior_status text := 'unknown';
  v_recorded_at timestamptz := now();
  v_existing_event public.customer_contact_consent_events%rowtype;
  v_evidence_kind text;
  v_note text := btrim(coalesce(p_evidence_note, ''));
begin
  if p_conversation_id is null then
    raise exception 'Conversation is required';
  end if;
  if coalesce(p_address_normalized, '') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A normalized mobile number is required';
  end if;
  if p_next_status not in ('opted_in', 'opted_out') then
    raise exception 'Invalid SMS consent decision';
  end if;
  if char_length(btrim(coalesce(p_recorded_by, ''))) not between 2 and 120 then
    raise exception 'Consent actor is required';
  end if;
  if char_length(btrim(coalesce(p_source_path, ''))) not between 2 and 300 then
    raise exception 'Consent source path is required';
  end if;
  if char_length(btrim(coalesce(p_idempotency_key, ''))) not between 12 and 200 then
    raise exception 'Consent idempotency key is required';
  end if;

  if p_next_status = 'opted_in' then
    if p_attested is not true then
      raise exception 'Explicit customer consent attestation is required';
    end if;
    if char_length(v_note) not between 12 and 1000 then
      raise exception 'Describe when and how the customer explicitly consented';
    end if;
    v_evidence_kind := 'founder_attested_explicit_consent';
  else
    v_evidence_kind := 'founder_recorded_customer_opt_out';
    if char_length(v_note) < 8 then
      v_note := 'Customer asked SqueegeeKing to stop texting this number.';
    end if;
  end if;

  select conversation.homeowner_id
    into v_homeowner_id
  from public.customer_conversations as conversation
  where conversation.id = p_conversation_id;
  if not found or v_homeowner_id is null then
    raise exception 'A homeowner conversation is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select event.*
    into v_existing_event
  from public.customer_contact_consent_events as event
  where event.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event.conversation_id is distinct from p_conversation_id
       or v_existing_event.homeowner_id is distinct from v_homeowner_id
       or v_existing_event.address_normalized is distinct from p_address_normalized
       or v_existing_event.next_status is distinct from p_next_status then
      raise exception 'Consent idempotency key belongs to another decision';
    end if;
    return query
      select
        point.id,
        point.consent_status,
        point.verification_status,
        point.consent_recorded_at
      from public.customer_contact_points as point
      where point.id = v_existing_event.contact_point_id;
    return;
  end if;

  select point.consent_status
    into v_prior_status
  from public.customer_contact_points as point
  where point.channel = 'sms'
    and point.address_normalized = p_address_normalized;
  if found then
    if not exists (
      select 1
      from public.customer_contact_points as point
      where point.channel = 'sms'
        and point.address_normalized = p_address_normalized
        and point.homeowner_id = v_homeowner_id
    ) then
      raise exception 'This phone number belongs to another homeowner';
    end if;
  else
    v_prior_status := 'unknown';
  end if;

  update public.customer_contact_points
  set is_primary = false
  where homeowner_id = v_homeowner_id
    and channel = 'sms'
    and address_normalized <> p_address_normalized
    and is_primary;

  insert into public.customer_contact_points (
    homeowner_id,
    channel,
    address_normalized,
    address_masked,
    is_primary,
    verification_status,
    verified_at,
    consent_status,
    consent_source,
    consent_recorded_at,
    opt_out_reason
  ) values (
    v_homeowner_id,
    'sms',
    p_address_normalized,
    '***-***-' || right(regexp_replace(p_address_normalized, '[^0-9]', '', 'g'), 4),
    true,
    'verified',
    v_recorded_at,
    p_next_status,
    v_evidence_kind,
    v_recorded_at,
    case
      when p_next_status = 'opted_out' then 'founder_recorded_customer_request'
      else null
    end
  )
  on conflict (channel, address_normalized) do update
  set is_primary = true,
      verification_status = 'verified',
      verified_at = excluded.verified_at,
      consent_status = excluded.consent_status,
      consent_source = excluded.consent_source,
      consent_recorded_at = excluded.consent_recorded_at,
      opt_out_reason = excluded.opt_out_reason
  where public.customer_contact_points.homeowner_id = excluded.homeowner_id
  returning id into v_contact_point_id;

  if v_contact_point_id is null then
    raise exception 'This phone number belongs to another homeowner';
  end if;

  insert into public.customer_contact_consent_events (
    conversation_id,
    contact_point_id,
    homeowner_id,
    address_normalized,
    prior_status,
    next_status,
    evidence_kind,
    evidence_note,
    disclosure_version,
    recorded_by,
    source_path,
    request_ip,
    user_agent,
    idempotency_key,
    recorded_at
  ) values (
    p_conversation_id,
    v_contact_point_id,
    v_homeowner_id,
    p_address_normalized,
    v_prior_status,
    p_next_status,
    v_evidence_kind,
    v_note,
    case
      when p_next_status = 'opted_in' then 'hq-explicit-transactional-v1'
      else null
    end,
    btrim(p_recorded_by),
    btrim(p_source_path),
    nullif(left(btrim(coalesce(p_request_ip, '')), 120), ''),
    nullif(left(btrim(coalesce(p_user_agent, '')), 1000), ''),
    btrim(p_idempotency_key),
    v_recorded_at
  );

  return query
    select
      point.id,
      point.consent_status,
      point.verification_status,
      point.consent_recorded_at
    from public.customer_contact_points as point
    where point.id = v_contact_point_id;
end;
$$;

-- Applying the hardening migration is a deliberate SMS kill switch. The owner
-- must complete provider verification and explicitly turn each SMS rule on.
update public.customer_communication_automation_rules
set enabled = false
where channel = 'sms';

alter table public.customer_communication_provider_verifications enable row level security;
alter table public.customer_contact_consent_events enable row level security;

revoke all privileges on table public.customer_communication_provider_verifications
  from public, anon, authenticated;
revoke all privileges on table public.customer_contact_consent_events
  from public, anon, authenticated;
revoke all on function public.record_hq_sms_consent_decision(
  uuid, text, text, text, boolean, text, text, text, text, text
) from public, anon, authenticated;

grant select, insert, update on table public.customer_communication_provider_verifications
  to service_role;
grant select, insert on table public.customer_contact_consent_events
  to service_role;
grant execute on function public.record_hq_sms_consent_decision(
  uuid, text, text, text, boolean, text, text, text, text, text
) to service_role;

comment on table public.customer_communication_provider_verifications is
  'Last signed webhook proof for the current Resend or Twilio secret.';
comment on table public.customer_contact_consent_events is
  'Append-only evidence for explicit HQ SMS consent and opt-out decisions.';
