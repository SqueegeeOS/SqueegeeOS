-- Meta Lead Ads ingestion and source attribution.
-- External IDs make webhook delivery idempotent. Consent evidence remains
-- explicit and is never inferred from a phone number or preferred channel.

alter table public.lead_intakes
  add column if not exists external_lead_id text,
  add column if not exists source_page_id text,
  add column if not exists source_form_id text,
  add column if not exists source_campaign_id text,
  add column if not exists source_campaign_name text,
  add column if not exists source_adset_id text,
  add column if not exists source_adset_name text,
  add column if not exists source_ad_id text,
  add column if not exists source_ad_name text,
  add column if not exists owner_sms_alert_status text,
  add column if not exists owner_sms_alert_provider_id text,
  add column if not exists owner_sms_alert_failure_code text,
  add column if not exists owner_sms_alert_attempted_at timestamptz;

alter table public.lead_intakes
  drop constraint if exists lead_intakes_source_check,
  add constraint lead_intakes_source_check check (
    source in ('request_form', 'facebook_lead_ad')
  ),
  drop constraint if exists lead_intakes_external_identity_check,
  add constraint lead_intakes_external_identity_check check (
    (source = 'request_form' and external_lead_id is null)
    or
    (source = 'facebook_lead_ad' and external_lead_id is not null)
  ),
  drop constraint if exists lead_intakes_owner_sms_alert_status_check,
  add constraint lead_intakes_owner_sms_alert_status_check check (
    owner_sms_alert_status is null
    or owner_sms_alert_status in ('sending', 'accepted', 'failed')
  );

alter table public.lead_intakes
  drop constraint if exists lead_intakes_source_external_lead_id_key,
  add constraint lead_intakes_source_external_lead_id_key
  unique (source, external_lead_id);

create index if not exists lead_intakes_source_submitted_at_idx
  on public.lead_intakes(source, submitted_at desc);
create index if not exists lead_intakes_campaign_submitted_at_idx
  on public.lead_intakes(source_campaign_id, submitted_at desc)
  where source_campaign_id is not null;

comment on column public.lead_intakes.external_lead_id is
  'Provider lead ID used for replay-safe ingestion.';
comment on column public.lead_intakes.source_form_id is
  'Meta Instant Form ID or future provider-equivalent form identifier.';
comment on column public.lead_intakes.owner_sms_alert_status is
  'Durable state for the private owner HOT LEAD SMS alert.';

-- The application still fails closed unless there is explicit consent and a
-- fully approved, webhook-verified Twilio sender.
update public.customer_communication_automation_rules
set enabled = true,
    consent_required = true,
    verified_contact_required = false
where id = 'lead_acknowledgement_sms';
