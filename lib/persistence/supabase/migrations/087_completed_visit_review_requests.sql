-- Founder-controlled post-visit review request automation.
-- Run after 086_owner_released_enrollment_documents.sql.
--
-- The rule is installed OFF. HQ may arm it only after the existing provider
-- readiness route confirms Twilio configuration, sender approval, and a signed
-- webhook for the current secret. Every send still requires a verified contact
-- and explicit active SMS consent.

begin;

alter table public.customer_communication_automation_rules
  drop constraint if exists customer_communication_automation_rules_event_type_check;
alter table public.customer_communication_automation_rules
  add constraint customer_communication_automation_rules_event_type_check
  check (
    event_type in (
      'lead_acknowledgement',
      'visit_reminder_24h',
      'review_request_after_visit'
    )
  );

insert into public.customer_communication_automation_rules (
  id,
  event_type,
  channel,
  enabled,
  consent_required,
  verified_contact_required,
  schedule_offset_minutes,
  template_key,
  configuration
) values (
  'review_request_after_visit_sms',
  'review_request_after_visit',
  'sms',
  false,
  true,
  true,
  1440,
  'review_request_after_visit_sms',
  jsonb_build_object(
    'review_policy', 'honest_feedback_only',
    'requires_no_open_service_issue', true,
    'requires_customer_visible_proof', true
  )
)
on conflict (id) do update
set consent_required = true,
    verified_contact_required = true,
    schedule_offset_minutes = 1440,
    template_key = excluded.template_key,
    configuration = excluded.configuration;

commit;
