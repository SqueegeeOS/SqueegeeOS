-- Secure Jobber OAuth connection state for server-side, read-only integration.
-- No Jobber customer, job, visit, or scheduling data is imported here.

create table if not exists public.jobber_connections (
  id text primary key default 'squeegeeking' check (id = 'squeegeeking'),
  status text not null default 'connected' check (
    status in ('connected', 'refresh_required', 'disconnected', 'error')
  ),
  account_id text not null unique,
  account_name text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  token_generation bigint not null default 1 check (token_generation > 0),
  graphql_version text not null,
  refresh_lease_id uuid,
  refresh_lease_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (refresh_lease_id is null and refresh_lease_expires_at is null)
    or
    (refresh_lease_id is not null and refresh_lease_expires_at is not null)
  )
);

create table if not exists public.jobber_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null references public.jobber_connections(id) on delete restrict,
  event_type text not null check (event_type in (
    'connected', 'reauthorized', 'refreshed', 'refresh_failed',
    'account_verified', 'disconnected'
  )),
  actor text not null,
  safe_details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists jobber_connection_events_connection_idx
  on public.jobber_connection_events(connection_id, occurred_at);

create or replace function public.acquire_jobber_refresh_lease(
  requested_lease_id uuid,
  lease_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if requested_lease_id is null or lease_seconds < 5 or lease_seconds > 120 then
    return false;
  end if;

  update public.jobber_connections
  set refresh_lease_id = requested_lease_id,
      refresh_lease_expires_at = now() + make_interval(secs => lease_seconds),
      updated_at = now()
  where id = 'squeegeeking'
    and (
      refresh_lease_id is null
      or refresh_lease_expires_at is null
      or refresh_lease_expires_at <= now()
    );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.acquire_jobber_refresh_lease(uuid, integer) from public;
grant execute on function public.acquire_jobber_refresh_lease(uuid, integer) to service_role;

create or replace function public.reject_jobber_connection_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'jobber_connection_events is append-only and immutable';
end;
$$;

drop trigger if exists jobber_connection_events_immutable
  on public.jobber_connection_events;
create trigger jobber_connection_events_immutable
  before update or delete on public.jobber_connection_events
  for each row execute function public.reject_jobber_connection_event_change();

drop trigger if exists jobber_connections_updated_at on public.jobber_connections;
create trigger jobber_connections_updated_at
  before update on public.jobber_connections
  for each row execute function public.set_updated_at();

alter table public.jobber_connections enable row level security;
alter table public.jobber_connection_events enable row level security;
-- Intentionally no anon/authenticated policies. Only the server service role
-- may read or write encrypted connection state.

comment on table public.jobber_connections is
  'Encrypted OAuth state for the single SqueegeeKing Jobber account; server/service-role only';
comment on column public.jobber_connections.access_token_ciphertext is
  'AES-256-GCM ciphertext; plaintext tokens must never be stored or logged';
comment on column public.jobber_connections.refresh_token_ciphertext is
  'AES-256-GCM ciphertext; overwritten atomically when refresh-token rotation is enabled';
