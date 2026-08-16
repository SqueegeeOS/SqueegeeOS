-- Stripe-hosted card setup for memberships that were already signed through
-- the in-person HomeAtlas flow. This does not collect a payment. It binds one
-- short-lived Checkout setup session to the exact membership, presentation,
-- signed agreement, customer, and signed billing-terms hash.

begin;

alter table public.membership_communications
  drop constraint if exists membership_communications_communication_type_check;
alter table public.membership_communications
  add constraint membership_communications_communication_type_check check (
    communication_type in ('welcome_email', 'payment_setup_email')
  );

create table if not exists public.membership_payment_handoffs (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique
    references public.memberships(id) on delete restrict,
  presentation_id uuid not null
    references public.presentations(id) on delete restrict,
  agreement_id uuid not null
    references public.signed_agreements(id) on delete restrict,
  homeowner_id uuid not null
    references public.homeowners(id) on delete restrict,
  property_id uuid not null
    references public.properties(id) on delete restrict,
  customer_email text not null,
  billing_terms_hash text not null,
  status text not null default 'reserved' check (
    status in (
      'reserved',
      'session_ready',
      'email_sent',
      'completed',
      'needs_attention',
      'expired'
    )
  ),
  checkout_attempt integer not null default 0 check (
    checkout_attempt between 0 and 25
  ),
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_setup_intent_id text,
  stripe_payment_method_id text,
  stripe_livemode boolean,
  stripe_payment_url text,
  stripe_payment_url_expires_at timestamptz,
  email_provider_message_id text,
  email_sent_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_by text not null default 'homeatlas_hq',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_email = lower(trim(customer_email))),
  check (customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (char_length(customer_email) <= 320),
  check (billing_terms_hash ~ '^[0-9a-f]{64}$'),
  check (last_error_code is null or char_length(last_error_code) <= 100),
  check (last_error_message is null or char_length(last_error_message) <= 2000),
  check (
    stripe_payment_url_expires_at is null
    or stripe_payment_url_expires_at > created_at
  )
);

create unique index if not exists membership_payment_handoffs_session_uidx
  on public.membership_payment_handoffs(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists membership_payment_handoffs_setup_intent_uidx
  on public.membership_payment_handoffs(stripe_setup_intent_id)
  where stripe_setup_intent_id is not null;
create index if not exists membership_payment_handoffs_status_updated_idx
  on public.membership_payment_handoffs(status, updated_at desc);

drop trigger if exists membership_payment_handoffs_updated_at
  on public.membership_payment_handoffs;
create trigger membership_payment_handoffs_updated_at
  before update on public.membership_payment_handoffs
  for each row execute function public.set_updated_at();

create table if not exists public.membership_payment_handoff_events (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null
    references public.membership_payment_handoffs(id) on delete restrict,
  event_type text not null,
  actor text not null,
  provider text,
  provider_event_key text,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (nullif(trim(event_type), '') is not null),
  check (char_length(event_type) <= 100),
  check (nullif(trim(actor), '') is not null),
  check (char_length(actor) <= 100),
  check (provider is null or char_length(provider) <= 40),
  check (provider_event_key is null or char_length(provider_event_key) <= 255)
);

create unique index if not exists membership_payment_handoff_events_provider_uidx
  on public.membership_payment_handoff_events(provider, provider_event_key)
  where provider is not null and provider_event_key is not null;
create index if not exists membership_payment_handoff_events_handoff_idx
  on public.membership_payment_handoff_events(handoff_id, occurred_at desc);

drop trigger if exists membership_payment_handoff_events_immutable
  on public.membership_payment_handoff_events;
create trigger membership_payment_handoff_events_immutable
  before update or delete on public.membership_payment_handoff_events
  for each row execute function public.reject_immutable_ledger_change();

comment on table public.membership_payment_handoffs is
  'Private, idempotent Stripe-hosted card setup state for an already-signed membership. Checkout URLs never cross a public HomeAtlas API.';
comment on table public.membership_payment_handoff_events is
  'Append-only audit evidence for hosted payment setup issuance, email acceptance, Stripe completion, and repair needs.';

alter table public.membership_payment_handoffs enable row level security;
alter table public.membership_payment_handoff_events enable row level security;

revoke all privileges on table public.membership_payment_handoffs
  from public, anon, authenticated;
revoke all privileges on table public.membership_payment_handoff_events
  from public, anon, authenticated;

grant select, insert, update on table public.membership_payment_handoffs
  to service_role;
grant select, insert on table public.membership_payment_handoff_events
  to service_role;

-- Keep the privacy probe complete as the signed-customer handoff gains a
-- Stripe URL, recipient address, and provider delivery identifiers.
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
