-- Atlas Pulse delivery ledger and authenticated integration event inbox.
-- Run after 035_jobber_full_sync_and_customer_links.sql.

create table if not exists public.membership_communications (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  communication_type text not null check (communication_type in ('welcome_email')),
  channel text not null default 'email' check (channel = 'email'),
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text,
  idempotency_key text not null,
  destination_masked text,
  status text not null check (status in (
    'accepted', 'delivered', 'delivery_delayed', 'bounced', 'failed',
    'skipped', 'complained'
  )),
  reason text,
  sent_at timestamptz,
  provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create unique index if not exists membership_communications_provider_message_uidx
  on public.membership_communications(provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists membership_communications_membership_idx
  on public.membership_communications(membership_id, updated_at desc);

drop trigger if exists membership_communications_updated_at
  on public.membership_communications;
create trigger membership_communications_updated_at
  before update on public.membership_communications
  for each row execute function public.set_updated_at();

create table if not exists public.resend_webhook_events (
  svix_id text primary key,
  event_type text not null,
  provider_message_id text,
  occurred_at timestamptz not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists resend_webhook_events_message_idx
  on public.resend_webhook_events(provider_message_id, occurred_at desc);

create or replace function public.apply_resend_delivery_event(
  p_svix_id text,
  p_event_type text,
  p_provider_message_id text,
  p_occurred_at timestamptz,
  p_payload_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_event boolean := false;
  next_status text;
begin
  insert into public.resend_webhook_events (
    svix_id,
    event_type,
    provider_message_id,
    occurred_at,
    payload_hash
  ) values (
    p_svix_id,
    p_event_type,
    p_provider_message_id,
    p_occurred_at,
    p_payload_hash
  )
  on conflict (svix_id) do nothing;

  inserted_event := found;
  if not inserted_event then
    return false;
  end if;

  next_status := case p_event_type
    when 'email.sent' then 'accepted'
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delivery_delayed'
    when 'email.bounced' then 'bounced'
    when 'email.failed' then 'failed'
    when 'email.complained' then 'complained'
    else null
  end;

  if next_status is not null and p_provider_message_id is not null then
    update public.membership_communications
    set status = next_status,
        provider_event_at = p_occurred_at
    where provider = 'resend'
      and provider_message_id = p_provider_message_id
      and (
        provider_event_at is null
        or provider_event_at <= p_occurred_at
      );
  end if;

  update public.resend_webhook_events
  set processed_at = now()
  where svix_id = p_svix_id;

  return true;
end;
$$;

revoke all on function public.apply_resend_delivery_event(
  text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.apply_resend_delivery_event(
  text, text, text, timestamptz, text
) to service_role;

create table if not exists public.jobber_webhook_events (
  event_key text primary key,
  topic text not null,
  app_id text,
  account_id text,
  item_id text,
  occurred_at timestamptz,
  payload_hash text not null,
  sync_scope text not null default 'ignored' check (
    sync_scope in ('clients', 'visits', 'full', 'ignored')
  ),
  status text not null default 'received' check (
    status in ('received', 'processing', 'processed', 'ignored', 'failed')
  ),
  sync_summary jsonb,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists jobber_webhook_events_received_idx
  on public.jobber_webhook_events(received_at desc);
create index if not exists jobber_webhook_events_status_idx
  on public.jobber_webhook_events(status, received_at);
create index if not exists jobber_webhook_events_scope_idx
  on public.jobber_webhook_events(sync_scope, received_at desc);

drop trigger if exists jobber_webhook_events_updated_at
  on public.jobber_webhook_events;
create trigger jobber_webhook_events_updated_at
  before update on public.jobber_webhook_events
  for each row execute function public.set_updated_at();

alter table public.membership_communications enable row level security;
alter table public.resend_webhook_events enable row level security;
alter table public.jobber_webhook_events enable row level security;
-- No anon/authenticated policies. These ledgers contain private delivery and
-- integration metadata and are available only through authenticated HQ routes.

comment on table public.membership_communications is
  'Atlas Pulse ledger for customer-facing membership communications and provider delivery state';
comment on table public.jobber_webhook_events is
  'Deduplicated authenticated Jobber webhook inbox; payload contents are intentionally not stored';
