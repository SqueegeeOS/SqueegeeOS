-- Provider-neutral customer communications foundation.
-- Run after 040_close_lead_intake_anon_access.sql.
--
-- Homeowners are the canonical customer identity. Lead-only conversations are
-- allowed before conversion, but property and membership context is accepted
-- only after the conversation has been attached to a homeowner.

-- Capture explicit SMS consent on the public intake record before any customer
-- identity or contact point necessarily exists. Existing rows remain unknown.
alter table public.lead_intakes
  add column if not exists sms_consent_status text not null default 'unknown';

alter table public.lead_intakes
  add column if not exists sms_consent_recorded_at timestamptz;

alter table public.lead_intakes
  add column if not exists email_delivery_status text not null default 'active';

alter table public.lead_intakes
  add column if not exists email_delivery_status_recorded_at timestamptz;

alter table public.lead_intakes
  drop constraint if exists lead_intakes_email_delivery_status_check;
alter table public.lead_intakes
  add constraint lead_intakes_email_delivery_status_check
  check (email_delivery_status in ('active', 'bounced', 'complained'));

alter table public.lead_intakes
  drop constraint if exists lead_intakes_sms_consent_status_check;
alter table public.lead_intakes
  add constraint lead_intakes_sms_consent_status_check
  check (sms_consent_status in ('unknown', 'opted_in', 'opted_out'));

alter table public.lead_intakes
  drop constraint if exists lead_intakes_sms_consent_recorded_at_check;
alter table public.lead_intakes
  add constraint lead_intakes_sms_consent_recorded_at_check
  check (
    (sms_consent_status = 'unknown' and sms_consent_recorded_at is null)
    or
    (sms_consent_status in ('opted_in', 'opted_out') and sms_consent_recorded_at is not null)
  );

create table if not exists public.customer_contact_points (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references public.homeowners(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  address_normalized text not null,
  address_masked text,
  is_primary boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'invalid')),
  verified_at timestamptz,
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'opted_in', 'opted_out')),
  consent_source text,
  consent_recorded_at timestamptz,
  opt_out_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contact_points_address_length_check
    check (char_length(address_normalized) between 3 and 320),
  constraint customer_contact_points_consent_time_check
    check (
      (consent_status = 'unknown' and consent_recorded_at is null)
      or
      (consent_status in ('opted_in', 'opted_out') and consent_recorded_at is not null)
    ),
  unique (channel, address_normalized)
);

create unique index if not exists customer_contact_points_primary_channel_uidx
  on public.customer_contact_points(homeowner_id, channel)
  where is_primary;
create index if not exists customer_contact_points_homeowner_idx
  on public.customer_contact_points(homeowner_id, channel, updated_at desc);

drop trigger if exists customer_contact_points_updated_at
  on public.customer_contact_points;
create trigger customer_contact_points_updated_at
  before update on public.customer_contact_points
  for each row execute function public.set_updated_at();

create table if not exists public.customer_communication_automation_rules (
  id text primary key,
  event_type text not null check (
    event_type in ('lead_acknowledgement', 'visit_reminder_24h')
  ),
  channel text not null check (channel in ('email', 'sms')),
  enabled boolean not null default false,
  consent_required boolean not null default true,
  verified_contact_required boolean not null default true,
  schedule_offset_minutes integer not null default 0
    check (schedule_offset_minutes between -525600 and 525600),
  template_key text not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel)
);

drop trigger if exists customer_communication_automation_rules_updated_at
  on public.customer_communication_automation_rules;
create trigger customer_communication_automation_rules_updated_at
  before update on public.customer_communication_automation_rules
  for each row execute function public.set_updated_at();

insert into public.customer_communication_automation_rules (
  id,
  event_type,
  channel,
  enabled,
  consent_required,
  verified_contact_required,
  schedule_offset_minutes,
  template_key
) values
  (
    'lead_acknowledgement_email',
    'lead_acknowledgement',
    'email',
    true,
    false,
    false,
    0,
    'lead_acknowledgement_email'
  ),
  (
    'lead_acknowledgement_sms',
    'lead_acknowledgement',
    'sms',
    false,
    true,
    false,
    0,
    'lead_acknowledgement_sms'
  ),
  (
    'visit_reminder_24h_email',
    'visit_reminder_24h',
    'email',
    false,
    false,
    false,
    -1440,
    'visit_reminder_24h_email'
  ),
  (
    'visit_reminder_24h_sms',
    'visit_reminder_24h',
    'sms',
    false,
    true,
    true,
    -1440,
    'visit_reminder_24h_sms'
  )
on conflict (id) do nothing;

-- Explicit lead-form consent is the only narrow verification override. Manual
-- sends and appointment reminders still require a verified contact point.
update public.customer_communication_automation_rules
set consent_required = true,
    verified_contact_required = false
where id = 'lead_acknowledgement_sms';

create table if not exists public.customer_conversations (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid references public.homeowners(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  lead_intake_id uuid references public.lead_intakes(id) on delete restrict,
  subject text,
  status text not null default 'open'
    check (status in ('open', 'closed', 'archived')),
  assigned_to text,
  provider text,
  provider_thread_id text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_conversations_identity_check
    check (homeowner_id is not null or lead_intake_id is not null),
  constraint customer_conversations_provider_thread_check
    check (
      (provider is null and provider_thread_id is null)
      or
      (provider is not null and provider_thread_id is not null)
    )
);

create unique index if not exists customer_conversations_provider_thread_uidx
  on public.customer_conversations(provider, provider_thread_id)
  where provider is not null and provider_thread_id is not null;
create index if not exists customer_conversations_homeowner_idx
  on public.customer_conversations(homeowner_id, last_message_at desc);
create unique index if not exists customer_conversations_lead_uidx
  on public.customer_conversations(lead_intake_id)
  where lead_intake_id is not null;
create index if not exists customer_conversations_property_idx
  on public.customer_conversations(property_id, last_message_at desc);

create or replace function public.validate_customer_conversation_context()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  property_homeowner_id uuid;
  membership_homeowner_id uuid;
  membership_property_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.homeowner_id is not null
       and new.homeowner_id is distinct from old.homeowner_id then
      raise exception 'Resolved homeowner identity cannot be reassigned';
    end if;
  end if;

  if new.homeowner_id is null then
    if new.property_id is not null or new.membership_id is not null then
      raise exception
        'Property and membership context require a resolved homeowner identity';
    end if;
    return new;
  end if;

  if new.property_id is not null then
    select property.homeowner_id
      into property_homeowner_id
    from public.properties as property
    where property.id = new.property_id;

    if not found then
      raise exception 'Property context does not exist';
    end if;
    if property_homeowner_id is distinct from new.homeowner_id then
      raise exception 'Property context belongs to another homeowner';
    end if;
  end if;

  if new.membership_id is not null then
    select membership.homeowner_id, membership.property_id
      into membership_homeowner_id, membership_property_id
    from public.memberships as membership
    where membership.id = new.membership_id;

    if not found then
      raise exception 'Membership context does not exist';
    end if;
    if membership_homeowner_id is distinct from new.homeowner_id then
      raise exception 'Membership context belongs to another homeowner';
    end if;
    if new.property_id is not null
       and membership_property_id is distinct from new.property_id then
      raise exception 'Membership context belongs to another property';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_conversations_validate_context
  on public.customer_conversations;
create trigger customer_conversations_validate_context
  before insert or update of homeowner_id, property_id, membership_id
  on public.customer_conversations
  for each row execute function public.validate_customer_conversation_context();

drop trigger if exists customer_conversations_updated_at
  on public.customer_conversations;
create trigger customer_conversations_updated_at
  before update on public.customer_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.customer_conversations(id) on delete cascade,
  contact_point_id uuid
    references public.customer_contact_points(id) on delete set null,
  automation_rule_id text
    references public.customer_communication_automation_rules(id) on delete set null,
  reply_to_message_id uuid
    references public.customer_messages(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  channel text not null check (channel in ('email', 'sms')),
  provider text,
  provider_message_id text,
  idempotency_key text not null unique,
  sender_address_normalized text,
  recipient_address_normalized text,
  recipient_address_masked text,
  subject text,
  body_text text not null default '',
  delivery_status text not null default 'draft' check (
    delivery_status in (
      'draft', 'queued', 'scheduled', 'sending', 'accepted', 'sent',
      'delivered', 'opened', 'clicked', 'read', 'received',
      'delivery_delayed', 'failed', 'bounced', 'complained', 'cancelled'
    )
  ),
  scheduled_for timestamptz,
  provider_event_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_messages_scheduled_for_check
    check (delivery_status <> 'scheduled' or scheduled_for is not null),
  constraint customer_messages_provider_message_check
    check (provider_message_id is null or provider is not null)
);

create unique index if not exists customer_messages_provider_message_uidx
  on public.customer_messages(provider, provider_message_id)
  where provider is not null and provider_message_id is not null;
create index if not exists customer_messages_conversation_idx
  on public.customer_messages(conversation_id, created_at desc);
create index if not exists customer_messages_scheduled_idx
  on public.customer_messages(scheduled_for, created_at)
  where delivery_status = 'scheduled';

create or replace function public.validate_customer_message_contact_point()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  conversation_homeowner_id uuid;
  contact_homeowner_id uuid;
  contact_channel text;
begin
  if new.contact_point_id is null then
    return new;
  end if;

  select conversation.homeowner_id
    into conversation_homeowner_id
  from public.customer_conversations as conversation
  where conversation.id = new.conversation_id;

  if not found then
    raise exception 'Conversation does not exist';
  end if;
  if conversation_homeowner_id is null then
    raise exception 'Lead-only conversations cannot use homeowner contact points';
  end if;

  select contact.homeowner_id, contact.channel
    into contact_homeowner_id, contact_channel
  from public.customer_contact_points as contact
  where contact.id = new.contact_point_id;

  if not found then
    raise exception 'Contact point does not exist';
  end if;
  if contact_homeowner_id is distinct from conversation_homeowner_id then
    raise exception 'Contact point belongs to another homeowner';
  end if;
  if contact_channel is distinct from new.channel then
    raise exception 'Contact point channel does not match message channel';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_messages_validate_contact_point
  on public.customer_messages;
create trigger customer_messages_validate_contact_point
  before insert or update of conversation_id, contact_point_id, channel
  on public.customer_messages
  for each row execute function public.validate_customer_message_contact_point();

drop trigger if exists customer_messages_updated_at
  on public.customer_messages;
create trigger customer_messages_updated_at
  before update on public.customer_messages
  for each row execute function public.set_updated_at();

create table if not exists public.customer_communication_webhook_events (
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_message_id text,
  customer_message_id uuid
    references public.customer_messages(id) on delete set null,
  occurred_at timestamptz,
  payload_hash text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, provider_event_id),
  constraint customer_communication_webhook_payload_hash_check
    check (char_length(payload_hash) between 32 and 128)
);

create index if not exists customer_communication_webhook_message_idx
  on public.customer_communication_webhook_events(
    provider,
    provider_message_id,
    occurred_at desc
  );
create index if not exists customer_communication_webhook_pending_idx
  on public.customer_communication_webhook_events(received_at)
  where processing_status = 'received';

alter table public.customer_contact_points enable row level security;
alter table public.customer_communication_automation_rules enable row level security;
alter table public.customer_conversations enable row level security;
alter table public.customer_messages enable row level security;
alter table public.customer_communication_webhook_events enable row level security;

revoke all privileges on table public.customer_contact_points
  from public, anon, authenticated;
revoke all privileges on table public.customer_communication_automation_rules
  from public, anon, authenticated;
revoke all privileges on table public.customer_conversations
  from public, anon, authenticated;
revoke all privileges on table public.customer_messages
  from public, anon, authenticated;
revoke all privileges on table public.customer_communication_webhook_events
  from public, anon, authenticated;

grant select, insert, update, delete on table public.customer_contact_points
  to service_role;
grant select, insert, update, delete on table public.customer_communication_automation_rules
  to service_role;
grant select, insert, update, delete on table public.customer_conversations
  to service_role;
grant select, insert, update, delete on table public.customer_messages
  to service_role;
grant select, insert, update, delete on table public.customer_communication_webhook_events
  to service_role;

revoke all on function public.validate_customer_conversation_context()
  from public, anon, authenticated;
grant execute on function public.validate_customer_conversation_context()
  to service_role;
revoke all on function public.validate_customer_message_contact_point()
  from public, anon, authenticated;
grant execute on function public.validate_customer_message_contact_point()
  to service_role;

comment on table public.customer_contact_points is
  'Provider-neutral verified customer destinations and auditable consent state';
comment on table public.customer_conversations is
  'Customer threads anchored to a homeowner or provisional lead with explicit optional property and membership context';
comment on table public.customer_messages is
  'Idempotent inbound, outbound, and scheduled customer messages across email and SMS';
comment on table public.customer_communication_automation_rules is
  'Founder-controlled transactional communication automation defaults';
comment on table public.customer_communication_webhook_events is
  'Payload-minimized provider webhook event ledger with replay deduplication';

-- Extend the production privacy posture check to every new table carrying
-- customer destinations, message content, or delivery metadata.
create or replace function public.homeatlas_security_posture()
returns table(
  customer_public_policy_count bigint,
  customer_public_privilege_count bigint,
  admin_rate_limit_ready boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with customer_tables(table_name) as (
    values
      ('homeowners'),
      ('properties'),
      ('home_care_plans'),
      ('memberships'),
      ('signed_agreements'),
      ('property_assets'),
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events')
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
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in (select table_name from customer_tables)
        and (
          'anon' = any(p.roles)
          or 'authenticated' = any(p.roles)
          or 'public' = any(p.roles)
        )
    ),
    (
      select count(*)
      from customer_tables t
      cross join public_roles r
      cross join table_privileges p
      where has_table_privilege(
        r.role_name,
        format('public.%I', t.table_name),
        p.privilege_name
      )
    ),
    to_regclass('public.admin_unlock_rate_limits') is not null;
$$;

revoke all on function public.homeatlas_security_posture()
  from public, anon, authenticated;
grant execute on function public.homeatlas_security_posture()
  to service_role;
