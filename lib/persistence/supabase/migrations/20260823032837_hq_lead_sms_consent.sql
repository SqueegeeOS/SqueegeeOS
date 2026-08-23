-- Let HQ record explicit SMS permission for a lead-only conversation without
-- manufacturing a homeowner. Consent and exact-number verification remain
-- separate, durable facts, and every manual decision has append-only evidence.

alter table public.lead_intakes
  add column if not exists sms_verified_at timestamptz;

comment on column public.lead_intakes.sms_verified_at is
  'When HQ or a signature-verified inbound SMS established control of the exact normalized lead phone.';

create table if not exists public.lead_sms_consent_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.customer_conversations(id) on delete restrict,
  lead_intake_id uuid not null
    references public.lead_intakes(id) on delete restrict,
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

create index if not exists lead_sms_consent_events_lead_idx
  on public.lead_sms_consent_events(lead_intake_id, recorded_at desc);

drop trigger if exists lead_sms_consent_events_immutable
  on public.lead_sms_consent_events;
create trigger lead_sms_consent_events_immutable
  before update or delete on public.lead_sms_consent_events
  for each row execute function public.reject_customer_contact_consent_event_mutation();

create or replace function public.record_hq_lead_sms_consent_decision(
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
  lead_intake_id uuid,
  consent_status text,
  verification_status text,
  consent_recorded_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_lead_intake_id uuid;
  v_homeowner_id uuid;
  v_lead_phone text;
  v_lead_phone_digits text;
  v_lead_phone_normalized text;
  v_prior_status text := 'unknown';
  v_recorded_at timestamptz := now();
  v_existing_event public.lead_sms_consent_events%rowtype;
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

  select conversation.lead_intake_id, conversation.homeowner_id
    into v_lead_intake_id, v_homeowner_id
  from public.customer_conversations as conversation
  where conversation.id = p_conversation_id;
  if not found or v_lead_intake_id is null or v_homeowner_id is not null then
    raise exception 'A lead-only conversation is required';
  end if;

  select lead.phone, lead.sms_consent_status
    into v_lead_phone, v_prior_status
  from public.lead_intakes as lead
  where lead.id = v_lead_intake_id;
  if not found then
    raise exception 'Lead phone record is unavailable';
  end if;

  v_lead_phone_digits := regexp_replace(coalesce(v_lead_phone, ''), '[^0-9]', '', 'g');
  if btrim(coalesce(v_lead_phone, '')) ~ '^\+[1-9][0-9]{7,14}$' then
    v_lead_phone_normalized := btrim(v_lead_phone);
  elsif char_length(v_lead_phone_digits) = 10 then
    v_lead_phone_normalized := '+1' || v_lead_phone_digits;
  elsif char_length(v_lead_phone_digits) = 11 and left(v_lead_phone_digits, 1) = '1' then
    v_lead_phone_normalized := '+' || v_lead_phone_digits;
  end if;
  if v_lead_phone_normalized is null
     or v_lead_phone_normalized is distinct from p_address_normalized then
    raise exception 'The lead phone changed; refresh before recording consent';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select event.*
    into v_existing_event
  from public.lead_sms_consent_events as event
  where event.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event.conversation_id is distinct from p_conversation_id
       or v_existing_event.lead_intake_id is distinct from v_lead_intake_id
       or v_existing_event.address_normalized is distinct from p_address_normalized
       or v_existing_event.next_status is distinct from p_next_status then
      raise exception 'Consent idempotency key belongs to another decision';
    end if;
    return query
      select
        lead.id,
        lead.sms_consent_status,
        case when lead.sms_verified_at is null then 'unverified' else 'verified' end,
        lead.sms_consent_recorded_at
      from public.lead_intakes as lead
      where lead.id = v_lead_intake_id;
    return;
  end if;

  update public.lead_intakes as lead
  set sms_consent_status = p_next_status,
      sms_consent_recorded_at = v_recorded_at,
      sms_verified_at = v_recorded_at,
      sms_consent_disclosure_version = case
        when p_next_status = 'opted_in' then 'hq-explicit-transactional-v1'
        else lead.sms_consent_disclosure_version
      end,
      sms_consent_source_path = btrim(p_source_path),
      sms_consent_ip_address = nullif(left(btrim(coalesce(p_request_ip, '')), 120), ''),
      sms_consent_user_agent = nullif(left(btrim(coalesce(p_user_agent, '')), 1000), '')
  where lead.id = v_lead_intake_id
    and (
      btrim(coalesce(lead.phone, '')) = p_address_normalized
      or regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g')
        in (
          regexp_replace(p_address_normalized, '[^0-9]', '', 'g'),
          right(regexp_replace(p_address_normalized, '[^0-9]', '', 'g'), 10)
        )
    );
  if not found then
    raise exception 'The lead phone changed; refresh before recording consent';
  end if;

  insert into public.lead_sms_consent_events (
    conversation_id,
    lead_intake_id,
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
    v_lead_intake_id,
    p_address_normalized,
    coalesce(v_prior_status, 'unknown'),
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
      lead.id,
      lead.sms_consent_status,
      case when lead.sms_verified_at is null then 'unverified' else 'verified' end,
      lead.sms_consent_recorded_at
    from public.lead_intakes as lead
    where lead.id = v_lead_intake_id;
end;
$$;

alter table public.lead_sms_consent_events enable row level security;

revoke all privileges on table public.lead_sms_consent_events
  from public, anon, authenticated;
revoke all on function public.record_hq_lead_sms_consent_decision(
  uuid, text, text, text, boolean, text, text, text, text, text
) from public, anon, authenticated;

grant select, insert on table public.lead_sms_consent_events
  to service_role;
grant execute on function public.record_hq_lead_sms_consent_decision(
  uuid, text, text, text, boolean, text, text, text, text, text
) to service_role;

comment on table public.lead_sms_consent_events is
  'Append-only evidence for explicit HQ SMS consent and opt-out decisions on lead-only conversations.';
