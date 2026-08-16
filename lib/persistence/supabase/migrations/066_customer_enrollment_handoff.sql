-- Customer enrollment handoff: attorney-controlled agreement versions,
-- DocuSign envelope evidence, Stripe-hosted card setup, and a private
-- customer-facing enrollment status page.
--
-- This migration deliberately seeds legal documents in attorney_review. No
-- packet may be sent until both versions are explicitly approved and every
-- external provider is configured. Applying the migration sends no email,
-- creates no Stripe session, and enables no automatic billing.

begin;

create table if not exists public.agreement_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_kind text not null check (
    document_kind in ('master_service_agreement', 'service_quote_agreement')
  ),
  version text not null,
  status text not null default 'attorney_review' check (
    status in ('draft', 'attorney_review', 'approved', 'retired')
  ),
  content_sha256 text,
  approved_at timestamptz,
  approved_by text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_kind, version),
  check (nullif(trim(version), '') is not null),
  check (char_length(version) <= 80),
  check (
    content_sha256 is null
    or content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  check (review_notes is null or char_length(review_notes) <= 4000),
  check (
    (status = 'approved'
      and content_sha256 is not null
      and approved_at is not null
      and nullif(trim(coalesce(approved_by, '')), '') is not null)
    or
    (status <> 'approved')
  )
);

create unique index if not exists agreement_document_versions_one_approved_kind_uidx
  on public.agreement_document_versions(document_kind)
  where status = 'approved';

drop trigger if exists agreement_document_versions_updated_at
  on public.agreement_document_versions;
create trigger agreement_document_versions_updated_at
  before update on public.agreement_document_versions
  for each row execute function public.set_updated_at();

insert into public.agreement_document_versions (
  document_kind,
  version,
  status,
  review_notes
) values
  (
    'master_service_agreement',
    'ca-msa-v1-draft',
    'attorney_review',
    'California LLC master terms. Attorney must confirm legal entity, risk allocation, venue, and enforceability before approval.'
  ),
  (
    'service_quote_agreement',
    'ca-service-quote-v1-draft',
    'attorney_review',
    'Property-specific scope, first and recurring rates, renewal, cancellation, rate-change notice, and home-solicitation notice. Attorney approval required.'
  )
on conflict (document_kind, version) do nothing;

-- Remote/online enrollment needs a direct online cancellation lane. Reuse the
-- token-authenticated member-care case system so the customer gets a durable
-- timestamped request without exposing membership data publicly.
alter table public.customer_service_cases
  drop constraint if exists customer_service_cases_category_check;
alter table public.customer_service_cases
  add constraint customer_service_cases_category_check check (
    category in (
      'service_quality',
      'damage_concern',
      'access_issue',
      'billing_question',
      'scheduling_question',
      'membership_cancellation',
      'other'
    )
  );

create table if not exists public.enrollment_packets (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null unique
    references public.presentations(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  agreement_tier text not null check (
    agreement_tier in ('biannual', 'triannual', 'quarterly')
  ),
  first_visit_price_cents integer not null check (first_visit_price_cents > 0),
  recurring_visit_price_cents integer not null check (
    recurring_visit_price_cents > 0
  ),
  annualized_value_cents integer not null check (annualized_value_cents > 0),
  sales_context text not null check (
    sales_context in ('customer_home', 'business_premises', 'remote', 'other')
  ),
  home_solicitation_notice_days smallint check (
    home_solicitation_notice_days is null
    or home_solicitation_notice_days in (3, 5)
  ),
  msa_version_id uuid not null
    references public.agreement_document_versions(id) on delete restrict,
  service_agreement_version_id uuid not null
    references public.agreement_document_versions(id) on delete restrict,
  document_snapshot jsonb not null,
  public_token_sha256 text not null unique check (
    public_token_sha256 ~ '^[0-9a-f]{64}$'
  ),
  public_token_expires_at timestamptz not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'signature_sent',
      'signature_complete',
      'payment_ready',
      'payment_sent',
      'payment_complete',
      'portal_ready',
      'needs_attention',
      'voided'
    )
  ),
  docusign_envelope_id text,
  docusign_status text,
  signature_sent_at timestamptz,
  signed_at timestamptz,
  signed_agreement_id uuid
    references public.signed_agreements(id) on delete restrict,
  homeowner_id uuid references public.homeowners(id) on delete restrict,
  property_id uuid references public.properties(id) on delete restrict,
  membership_id uuid references public.memberships(id) on delete restrict,
  stripe_checkout_session_id text,
  stripe_setup_intent_id text,
  stripe_payment_method_id text,
  stripe_payment_url text,
  stripe_payment_url_expires_at timestamptz,
  stripe_checkout_attempt integer not null default 0 check (
    stripe_checkout_attempt between 0 and 25
  ),
  payment_link_sent_at timestamptz,
  payment_completed_at timestamptz,
  portal_ready_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_by text not null default 'homeatlas_hq',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(customer_name), '') is not null),
  check (char_length(customer_name) <= 160),
  check (customer_email = lower(trim(customer_email))),
  check (customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (char_length(customer_email) <= 320),
  check (
    (sales_context = 'customer_home'
      and home_solicitation_notice_days in (3, 5))
    or
    (sales_context <> 'customer_home'
      and home_solicitation_notice_days is null)
  ),
  check (public_token_expires_at > created_at),
  check (document_snapshot <> '{}'::jsonb),
  check (last_error_code is null or char_length(last_error_code) <= 100),
  check (last_error_message is null or char_length(last_error_message) <= 2000)
);

create unique index if not exists enrollment_packets_docusign_envelope_uidx
  on public.enrollment_packets(docusign_envelope_id)
  where docusign_envelope_id is not null;
create unique index if not exists enrollment_packets_stripe_session_uidx
  on public.enrollment_packets(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists enrollment_packets_stripe_setup_intent_uidx
  on public.enrollment_packets(stripe_setup_intent_id)
  where stripe_setup_intent_id is not null;
create index if not exists enrollment_packets_status_updated_idx
  on public.enrollment_packets(status, updated_at desc);
create index if not exists enrollment_packets_customer_email_idx
  on public.enrollment_packets(customer_email, created_at desc);

drop trigger if exists enrollment_packets_updated_at
  on public.enrollment_packets;
create trigger enrollment_packets_updated_at
  before update on public.enrollment_packets
  for each row execute function public.set_updated_at();

create table if not exists public.enrollment_packet_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_packet_id uuid not null
    references public.enrollment_packets(id) on delete restrict,
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

create unique index if not exists enrollment_packet_events_provider_key_uidx
  on public.enrollment_packet_events(provider, provider_event_key)
  where provider is not null and provider_event_key is not null;
create index if not exists enrollment_packet_events_packet_occurred_idx
  on public.enrollment_packet_events(enrollment_packet_id, occurred_at desc);

drop trigger if exists enrollment_packet_events_immutable
  on public.enrollment_packet_events;
create trigger enrollment_packet_events_immutable
  before update or delete on public.enrollment_packet_events
  for each row execute function public.reject_immutable_ledger_change();

alter table public.signed_agreements
  add column if not exists external_signature_provider text,
  add column if not exists external_envelope_id text,
  add column if not exists msa_version text,
  add column if not exists service_agreement_version text,
  add column if not exists completion_certificate_url text,
  add column if not exists document_snapshot jsonb;

create unique index if not exists signed_agreements_external_envelope_uidx
  on public.signed_agreements(external_signature_provider, external_envelope_id)
  where external_signature_provider is not null
    and external_envelope_id is not null;

comment on table public.agreement_document_versions is
  'Attorney-controlled legal document versions. HomeAtlas sends nothing unless one approved MSA and one approved service/quote agreement exist.';
comment on table public.enrollment_packets is
  'Private enrollment state machine linking a presentation, DocuSign evidence, Stripe-hosted card setup, and the final HomeAtlas portal.';
comment on table public.enrollment_packet_events is
  'Append-only enrollment audit trail. Provider event keys make retries idempotent.';
comment on constraint customer_service_cases_category_check
  on public.customer_service_cases is
  'Includes a direct token-authenticated online membership cancellation request lane.';
comment on column public.enrollment_packets.home_solicitation_notice_days is
  'Owner-selected California home-solicitation notice lane: 3 standard business days or 5 for a senior buyer. Attorney-approved template controls final wording.';
comment on column public.enrollment_packets.stripe_payment_url is
  'Short-lived Stripe-hosted setup-mode Checkout URL. Private server/HQ data; the public enrollment token only reveals it to its intended holder.';

alter table public.agreement_document_versions enable row level security;
alter table public.enrollment_packets enable row level security;
alter table public.enrollment_packet_events enable row level security;

revoke all privileges on table public.agreement_document_versions
  from public, anon, authenticated;
revoke all privileges on table public.enrollment_packets
  from public, anon, authenticated;
revoke all privileges on table public.enrollment_packet_events
  from public, anon, authenticated;

grant select, insert, update, delete on table public.agreement_document_versions
  to service_role;
grant select, insert, update, delete on table public.enrollment_packets
  to service_role;
grant select, insert on table public.enrollment_packet_events
  to service_role;

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
      ('enrollment_packet_events')
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
