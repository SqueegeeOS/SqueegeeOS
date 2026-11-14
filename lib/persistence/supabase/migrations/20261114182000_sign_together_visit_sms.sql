-- Optional service-text evidence captured with the signature, never inferred
-- from membership/payment authorization. Existing agreements remain unconsented.
alter table public.signed_agreements
  add column if not exists visit_sms_opt_in boolean not null default false,
  add column if not exists visit_sms_phone text,
  add column if not exists visit_sms_disclosure_version text;

alter table public.signed_agreements
  add constraint signed_agreement_visit_sms_evidence_check check (
    (visit_sms_opt_in = false and visit_sms_phone is null and visit_sms_disclosure_version is null)
    or (visit_sms_opt_in = true and visit_sms_phone is not null
      and visit_sms_phone ~ '^\+1[2-9][0-9]{9}$'
      and visit_sms_disclosure_version is not null
      and visit_sms_disclosure_version = 'sign-together-visit-reminders-v1')
  );

create or replace function public.record_signed_agreement_visit_sms_consent(
  p_agreement_id uuid,
  p_conversation_id uuid,
  p_address_normalized text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_homeowner_id uuid;
  v_homeowner_phone text;
  v_signed_at timestamptz;
  v_request_ip text;
  v_user_agent text;
  v_conversation_homeowner_id uuid;
  v_prior_status text := 'unknown';
  v_contact_point_id uuid;
  v_existing_event public.customer_contact_consent_events%rowtype;
  v_idempotency_key text := 'signed-agreement:' || p_agreement_id::text || ':visit-sms-v1';
  v_now timestamptz := now();
begin
  if p_address_normalized !~ '^\+1[2-9][0-9]{9}$' then
    raise exception 'A valid US mobile number is required';
  end if;

  select agreement.homeowner_id, agreement.signed_at, agreement.ip_address, agreement.user_agent
    into v_homeowner_id, v_signed_at, v_request_ip, v_user_agent
  from public.signed_agreements as agreement
  where agreement.id = p_agreement_id
    and agreement.status = 'complete'
    and agreement.visit_sms_opt_in = true
    and agreement.visit_sms_phone = p_address_normalized
    and agreement.visit_sms_disclosure_version = 'sign-together-visit-reminders-v1'
    and nullif(agreement.signature_image_url, '') is not null
  for update;
  if v_homeowner_id is null or v_signed_at is null then
    raise exception 'The signed agreement and its original affirmative text consent are required';
  end if;

  select conversation.homeowner_id
    into v_conversation_homeowner_id
  from public.customer_conversations as conversation
  where conversation.id = p_conversation_id;
  if v_conversation_homeowner_id is distinct from v_homeowner_id then
    raise exception 'The conversation does not belong to this customer';
  end if;

  select event.* into v_existing_event
  from public.customer_contact_consent_events as event
  where event.idempotency_key = v_idempotency_key;
  if found then
    if v_existing_event.homeowner_id is distinct from v_homeowner_id
       or v_existing_event.address_normalized is distinct from p_address_normalized then
      raise exception 'Agreement consent was already recorded for a different number';
    end if;
    return;
  end if;

  select homeowner.phone into v_homeowner_phone
  from public.homeowners as homeowner
  where homeowner.id = v_homeowner_id
  for update;
  if nullif(btrim(coalesce(v_homeowner_phone, '')), '') is not null
     and v_homeowner_phone <> p_address_normalized then
    raise exception 'The signed customer already has a different phone number';
  end if;

  select point.id, point.consent_status
    into v_contact_point_id, v_prior_status
  from public.customer_contact_points as point
  where point.channel = 'sms'
    and point.address_normalized = p_address_normalized
  for update;
  if v_contact_point_id is not null and not exists (
    select 1 from public.customer_contact_points as point
    where point.id = v_contact_point_id and point.homeowner_id = v_homeowner_id
  ) then
    raise exception 'This number belongs to another customer';
  end if;
  if v_prior_status = 'opted_out' then
    raise exception 'A previously opted-out number needs separate reconfirmation';
  end if;

  update public.homeowners
  set phone = p_address_normalized
  where id = v_homeowner_id and nullif(btrim(coalesce(phone, '')), '') is null;

  update public.customer_contact_points
  set is_primary = false
  where homeowner_id = v_homeowner_id and channel = 'sms'
    and address_normalized <> p_address_normalized and is_primary;

  insert into public.customer_contact_points (
    homeowner_id, channel, address_normalized, address_masked, is_primary,
    verification_status, verified_at, consent_status, consent_source,
    consent_recorded_at, opt_out_reason
  ) values (
    v_homeowner_id, 'sms', p_address_normalized,
    '***-***-' || right(p_address_normalized, 4), true,
    'verified', v_now, 'opted_in', 'customer_sign_together',
    v_now, null
  )
  on conflict (channel, address_normalized) do update
  set is_primary = true,
      verification_status = 'verified',
      verified_at = excluded.verified_at,
      consent_status = 'opted_in',
      consent_source = excluded.consent_source,
      consent_recorded_at = excluded.consent_recorded_at,
      opt_out_reason = null
  where public.customer_contact_points.homeowner_id = excluded.homeowner_id
    and public.customer_contact_points.consent_status <> 'opted_out'
  returning id into v_contact_point_id;
  if v_contact_point_id is null then
    raise exception 'Could not safely record this customer opt-in';
  end if;

  insert into public.customer_contact_consent_events (
    conversation_id, contact_point_id, homeowner_id, address_normalized,
    prior_status, next_status, evidence_kind, evidence_note,
    disclosure_version, recorded_by, source_path, request_ip, user_agent,
    idempotency_key, recorded_at
  ) values (
    p_conversation_id, v_contact_point_id, v_homeowner_id, p_address_normalized,
    coalesce(v_prior_status, 'unknown'), 'opted_in',
    'customer_signed_enrollment_opt_in',
    'Customer confirmed their mobile number and opted in to scheduled visit reminder texts while signing their service agreement together in HomeAtlas.',
    'sign-together-visit-reminders-v1', 'customer_signer',
    '/api/sign-agreement',
    nullif(left(btrim(coalesce(v_request_ip, '')), 120), ''),
    nullif(left(btrim(coalesce(v_user_agent, '')), 1000), ''),
    v_idempotency_key, v_now
  );
end;
$$;

revoke all on function public.record_signed_agreement_visit_sms_consent(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_signed_agreement_visit_sms_consent(
  uuid, uuid, text
) to service_role;

-- Consent evidence is a snapshot of the signing event. Later contact edits or
-- request retries must not rewrite it to manufacture a different consent.
create or replace function public.preserve_signed_agreement_visit_sms_evidence()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.visit_sms_opt_in, new.visit_sms_phone, new.visit_sms_disclosure_version)
     is distinct from
     (old.visit_sms_opt_in, old.visit_sms_phone, old.visit_sms_disclosure_version) then
    raise exception 'Original signing consent evidence cannot be changed';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_signed_agreement_visit_sms_evidence() from public, anon, authenticated;
create trigger preserve_signed_agreement_visit_sms_evidence
before update on public.signed_agreements
for each row execute function public.preserve_signed_agreement_visit_sms_evidence();
