begin;

-- A permanent, fail-closed claim: completion may have side effects even if the
-- HTTP request fails. Only an audited repair may resolve a started signature.
alter table public.enrollment_packets
  add column if not exists native_signature_started_at timestamptz,
  add column if not exists revision_id uuid;

create or replace function public.revise_unsigned_native_enrollment(
  p_packet_id uuid,
  p_expected_token_sha256 text,
  p_revision_id uuid,
  p_reason text,
  p_actor text,
  p_values jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  prior public.enrollment_packets;
  revised public.enrollment_packets;
begin
  select * into prior from public.enrollment_packets
    where id = p_packet_id for update;
  if not found then raise exception 'Enrollment packet not found'; end if;
  if prior.signature_provider <> 'homeatlas_native'
    or prior.status <> 'signature_sent'
    or prior.docusign_envelope_id is not null
    or prior.native_signature_started_at is not null
    or prior.signed_at is not null or prior.signed_agreement_id is not null
    or prior.membership_id is not null
    or prior.public_token_sha256 is distinct from p_expected_token_sha256
  then raise exception 'Packet changed, signing started, or packet is not eligible for unsigned revision'; end if;
  if exists (select 1 from public.memberships where presentation_id = prior.presentation_id)
    or exists (select 1 from public.signed_agreements where presentation_id = prior.presentation_id)
    or exists (select 1 from public.presentations where id = prior.presentation_id
      and (status = 'signed' or agreement_id is not null))
  then raise exception 'Signed agreements cannot be revised'; end if;
  if p_revision_id is null or nullif(trim(p_reason), '') is null
    or length(p_reason) > 1000 or nullif(trim(p_actor), '') is null
    or p_values->>'signature_provider' is distinct from 'homeatlas_native'
    or p_values->>'payment_rail' is distinct from prior.payment_rail
    or p_values->>'public_token_sha256' is not distinct from prior.public_token_sha256
  then raise exception 'Invalid revision request'; end if;

  -- The unique audit key makes retries fail before any new email is attempted.
  insert into public.enrollment_packet_events
    (enrollment_packet_id, event_type, actor, provider, provider_event_key, event_data)
  values (prior.id, 'unsigned_packet_revised', p_actor, 'homeatlas_native',
    'revision:' || p_revision_id::text,
    jsonb_build_object('reason', p_reason, 'revisionId', p_revision_id,
      'priorPacket', to_jsonb(prior), 'replacementSnapshot', p_values->'document_snapshot'));

  update public.enrollment_packet_access_tokens set revoked_at = now()
    where enrollment_packet_id = prior.id and revoked_at is null;
  update public.enrollment_packets set
    customer_name = p_values->>'customer_name',
    customer_email = p_values->>'customer_email',
    agreement_tier = p_values->>'agreement_tier',
    first_visit_price_cents = (p_values->>'first_visit_price_cents')::integer,
    recurring_visit_price_cents = (p_values->>'recurring_visit_price_cents')::integer,
    annualized_value_cents = (p_values->>'annualized_value_cents')::integer,
    sales_context = p_values->>'sales_context',
    home_solicitation_notice_days = (p_values->>'home_solicitation_notice_days')::smallint,
    msa_version_id = (p_values->>'msa_version_id')::uuid,
    service_agreement_version_id = (p_values->>'service_agreement_version_id')::uuid,
    document_snapshot = p_values->'document_snapshot',
    public_token_sha256 = p_values->>'public_token_sha256',
    public_token_expires_at = (p_values->>'public_token_expires_at')::timestamptz,
    revision_id = p_revision_id,
    status = 'draft', signature_sent_at = null,
    last_error_code = null, last_error_message = null
  where id = prior.id returning * into revised;
  return to_jsonb(revised);
end;
$$;
revoke all on function public.revise_unsigned_native_enrollment(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.revise_unsigned_native_enrollment(uuid, text, uuid, text, text, jsonb)
  to service_role;

-- Serialize signing with revision and recheck the presented token after locking.
-- In particular, a historical-token lookup must not bridge a concurrent revoke.
create or replace function public.claim_native_enrollment_signature(
  p_packet_id uuid, p_expected_token_sha256 text, p_presented_token_sha256 text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  packet public.enrollment_packets;
begin
  select * into packet from public.enrollment_packets where id = p_packet_id for update;
  if not found then return null; end if;
  if packet.signature_provider <> 'homeatlas_native'
    or packet.status <> 'signature_sent'
    or packet.native_signature_started_at is not null
    or packet.signed_at is not null or packet.signed_agreement_id is not null
    or packet.public_token_sha256 is distinct from p_expected_token_sha256
    or packet.public_token_expires_at <= now()
  then return null; end if;
  if packet.public_token_sha256 is distinct from p_presented_token_sha256
    and not exists (select 1 from public.enrollment_packet_access_tokens
      where enrollment_packet_id = packet.id and token_sha256 = p_presented_token_sha256
        and revoked_at is null and expires_at > now())
  then return null; end if;
  update public.enrollment_packets set native_signature_started_at = now()
    where id = packet.id returning * into packet;
  return to_jsonb(packet);
end;
$$;
revoke all on function public.claim_native_enrollment_signature(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_native_enrollment_signature(uuid, text, text)
  to service_role;

-- Protect against old deployments that predate the signing-claim RPC. Their
-- frozen snapshot must still match under the same packet lock before insertion.
create or replace function public.guard_native_enrollment_agreement_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  packet public.enrollment_packets;
begin
  select * into packet from public.enrollment_packets
    where presentation_id = new.presentation_id for update;
  if not found then
    if new.external_signature_provider = 'homeatlas_native' then
      raise exception 'Native enrollment packet not found';
    end if;
    return new;
  end if;
  -- An active native packet must be completed through its private signing flow,
  -- not the separate in-person path, which cannot prove the frozen scope.
  if packet.signature_provider = 'homeatlas_native'
    and new.external_signature_provider is distinct from 'homeatlas_native'
  then
    if packet.status in ('draft', 'voided') and packet.signature_sent_at is null
      and packet.revision_id is null and packet.native_signature_started_at is null
      and packet.signed_at is null and packet.signed_agreement_id is null
    then return new; end if;
    raise exception 'Use the existing private enrollment link to sign this presentation';
  end if;
  if new.external_signature_provider is distinct from 'homeatlas_native' then return new; end if;
  if packet.signature_provider <> 'homeatlas_native'
    or packet.id::text is distinct from new.external_envelope_id
    or packet.status <> 'signature_sent'
    or packet.signed_at is not null or packet.signed_agreement_id is not null
    or packet.document_snapshot is distinct from new.document_snapshot
    or (packet.revision_id is not null and packet.native_signature_started_at is null)
  then raise exception 'Native agreement is stale, already signed, or unclaimed'; end if;
  update public.enrollment_packets
    set native_signature_started_at = coalesce(native_signature_started_at, now())
    where id = packet.id;
  return new;
end;
$$;
revoke all on function public.guard_native_enrollment_agreement_insert()
  from public, anon, authenticated;
drop trigger if exists guard_native_enrollment_agreement_insert on public.signed_agreements;
create trigger guard_native_enrollment_agreement_insert
  before insert on public.signed_agreements
  for each row execute function public.guard_native_enrollment_agreement_insert();

commit;
