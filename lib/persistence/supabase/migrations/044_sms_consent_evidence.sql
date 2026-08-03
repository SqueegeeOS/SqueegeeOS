-- Preserve the disclosure and request context that supported each new public
-- request-form SMS opt-in. Historical consent remains explicitly distinguishable
-- because these evidence fields are nullable rather than backfilled by guesswork.

alter table public.lead_intakes
  add column if not exists sms_consent_disclosure_version text,
  add column if not exists sms_consent_source_path text,
  add column if not exists sms_consent_ip_address text,
  add column if not exists sms_consent_user_agent text;

alter table public.lead_intakes
  drop constraint if exists lead_intakes_sms_consent_evidence_state_check,
  add constraint lead_intakes_sms_consent_evidence_state_check check (
    sms_consent_status <> 'unknown'
    or (
      sms_consent_disclosure_version is null
      and sms_consent_source_path is null
      and sms_consent_ip_address is null
      and sms_consent_user_agent is null
    )
  );

comment on column public.lead_intakes.sms_consent_disclosure_version is
  'Version of the exact transactional SMS disclosure accepted on a new request.';
comment on column public.lead_intakes.sms_consent_source_path is
  'Public route where the opt-in was submitted.';
comment on column public.lead_intakes.sms_consent_ip_address is
  'Request IP evidence, when supplied by the trusted deployment proxy.';
comment on column public.lead_intakes.sms_consent_user_agent is
  'Request user-agent evidence, truncated by the application.';
