-- Supabase-authenticated Headquarters access and durable magic-link controls.
-- No auth users or Headquarters approvals are seeded by this migration.

create table if not exists public.hq_admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  role text not null check (role in ('owner', 'operator')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hq_admin_users_email_normalized_check check (
    email = lower(btrim(email)) and nullif(email, '') is not null
  )
);

create unique index if not exists hq_admin_users_normalized_email_unique
  on public.hq_admin_users (lower(btrim(email)));

create or replace function public.validate_hq_admin_user_auth_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  auth_email text;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Headquarters authorization user_id is immutable';
    end if;
  end if;

  select lower(btrim(auth_user.email)) into auth_email
  from auth.users auth_user
  where auth_user.id = new.user_id;

  if auth_email is null or new.email <> auth_email then
    raise exception 'Headquarters email must match the referenced Auth user';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_hq_admin_user_auth_email() from public;

drop trigger if exists hq_admin_users_validate_auth_email
  on public.hq_admin_users;
create trigger hq_admin_users_validate_auth_email
  before insert or update of user_id, email on public.hq_admin_users
  for each row execute function public.validate_hq_admin_user_auth_email();

create or replace function public.sync_hq_admin_user_auth_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  if new.email is null or nullif(btrim(new.email), '') is null then
    if exists (
      select 1
      from public.hq_admin_users
      where user_id = new.id
    ) then
      raise exception 'A Headquarters Auth user must retain an email';
    end if;
    return new;
  end if;

  update public.hq_admin_users
  set email = lower(btrim(new.email))
  where user_id = new.id;

  return new;
end;
$$;

revoke all on function public.sync_hq_admin_user_auth_email() from public;

drop trigger if exists hq_admin_users_sync_auth_email on auth.users;
create trigger hq_admin_users_sync_auth_email
  after update of email on auth.users
  for each row execute function public.sync_hq_admin_user_auth_email();

drop trigger if exists hq_admin_users_updated_at on public.hq_admin_users;
create trigger hq_admin_users_updated_at
  before update on public.hq_admin_users
  for each row execute function public.set_updated_at();

alter table public.hq_admin_users enable row level security;
revoke all on table public.hq_admin_users from anon, authenticated;
-- Intentionally no anon/authenticated policies. Authorization lookups are
-- server-only through the service role after Auth getUser verifies identity.

create table if not exists public.hq_admin_user_events (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null,
  change_type text not null check (
    change_type in ('created', 'updated', 'deleted')
  ),
  previous_email text,
  new_email text,
  previous_role text check (
    previous_role is null or previous_role in ('owner', 'operator')
  ),
  new_role text check (
    new_role is null or new_role in ('owner', 'operator')
  ),
  previous_active boolean,
  new_active boolean,
  changed_by_user_id uuid,
  database_actor text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists hq_admin_user_events_subject_idx
  on public.hq_admin_user_events (subject_user_id, occurred_at desc);

alter table public.hq_admin_user_events enable row level security;
revoke all on table public.hq_admin_user_events from anon, authenticated;

create or replace function public.record_hq_admin_user_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  request_subject text;
  request_subject_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.email is not distinct from old.email
    and new.role is not distinct from old.role
    and new.active is not distinct from old.active
  then
    return new;
  end if;

  request_subject := pg_catalog.current_setting(
    'request.jwt.claim.sub',
    true
  );
  if request_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    request_subject_id := request_subject::uuid;
  end if;

  insert into public.hq_admin_user_events (
    subject_user_id,
    change_type,
    previous_email,
    new_email,
    previous_role,
    new_role,
    previous_active,
    new_active,
    changed_by_user_id,
    database_actor
  ) values (
    case when tg_op = 'INSERT' then new.user_id else old.user_id end,
    case
      when tg_op = 'INSERT' then 'created'
      when tg_op = 'DELETE' then 'deleted'
      else 'updated'
    end,
    case when tg_op = 'INSERT' then null else old.email end,
    case when tg_op = 'DELETE' then null else new.email end,
    case when tg_op = 'INSERT' then null else old.role end,
    case when tg_op = 'DELETE' then null else new.role end,
    case when tg_op = 'INSERT' then null else old.active end,
    case when tg_op = 'DELETE' then null else new.active end,
    request_subject_id,
    session_user
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.record_hq_admin_user_change() from public;

drop trigger if exists hq_admin_users_record_change
  on public.hq_admin_users;
create trigger hq_admin_users_record_change
  after insert or delete or update of email, role, active
  on public.hq_admin_users
  for each row execute function public.record_hq_admin_user_change();

create table if not exists public.hq_magic_link_request_events (
  id uuid primary key default gen_random_uuid(),
  email_fingerprint text not null check (
    email_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  network_fingerprint text check (
    network_fingerprint is null or network_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  decision text not null check (decision in ('allowed', 'rate_limited')),
  occurred_at timestamptz not null default now()
);

create index if not exists hq_magic_link_request_email_window_idx
  on public.hq_magic_link_request_events (email_fingerprint, occurred_at desc)
  where decision = 'allowed';
create index if not exists hq_magic_link_request_network_window_idx
  on public.hq_magic_link_request_events (network_fingerprint, occurred_at desc)
  where decision = 'allowed' and network_fingerprint is not null;
create index if not exists hq_magic_link_denied_email_window_idx
  on public.hq_magic_link_request_events (email_fingerprint, occurred_at desc)
  where decision = 'rate_limited';
create index if not exists hq_magic_link_denied_network_window_idx
  on public.hq_magic_link_request_events (network_fingerprint, occurred_at desc)
  where decision = 'rate_limited' and network_fingerprint is not null;

create table if not exists public.hq_magic_link_delivery_events (
  id uuid primary key default gen_random_uuid(),
  request_event_id uuid not null unique
    references public.hq_magic_link_request_events(id) on delete restrict,
  outcome text not null check (
    outcome in (
      'provider_accepted', 'provider_rejected', 'provider_unknown'
    )
  ),
  occurred_at timestamptz not null default now()
);

create or replace function public.reject_hq_auth_audit_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception '% is append-only and immutable', tg_table_name;
end;
$$;

drop trigger if exists hq_magic_link_request_events_immutable
  on public.hq_magic_link_request_events;
create trigger hq_magic_link_request_events_immutable
  before update or delete on public.hq_magic_link_request_events
  for each row execute function public.reject_hq_auth_audit_change();

drop trigger if exists hq_magic_link_delivery_events_immutable
  on public.hq_magic_link_delivery_events;
create trigger hq_magic_link_delivery_events_immutable
  before update or delete on public.hq_magic_link_delivery_events
  for each row execute function public.reject_hq_auth_audit_change();

drop trigger if exists hq_admin_user_events_immutable
  on public.hq_admin_user_events;
create trigger hq_admin_user_events_immutable
  before update or delete on public.hq_admin_user_events
  for each row execute function public.reject_hq_auth_audit_change();

alter table public.hq_magic_link_request_events enable row level security;
alter table public.hq_magic_link_delivery_events enable row level security;
revoke all on table public.hq_magic_link_request_events from anon, authenticated;
revoke all on table public.hq_magic_link_delivery_events from anon, authenticated;
-- Fingerprints are HMAC-SHA256 values computed with a server-only key. Raw
-- email addresses and network identifiers never enter the limiter ledger.

create or replace function public.reserve_hq_magic_link_request(
  requested_email_fingerprint text,
  requested_network_fingerprint text,
  requested_window_seconds integer default 900,
  requested_email_limit integer default 3,
  requested_network_limit integer default 10
)
returns table (request_id uuid, is_allowed boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  next_request_id uuid := pg_catalog.gen_random_uuid();
  email_attempts integer;
  network_attempts integer := 0;
  next_allowed boolean;
begin
  if requested_email_fingerprint !~ '^[0-9a-f]{64}$'
    or (
      requested_network_fingerprint is not null
      and requested_network_fingerprint !~ '^[0-9a-f]{64}$'
    )
    or requested_window_seconds < 60
    or requested_window_seconds > 86400
    or requested_email_limit < 1
    or requested_email_limit > 20
    or requested_network_limit < 1
    or requested_network_limit > 100
  then
    raise exception 'Invalid Headquarters magic-link limiter input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hq-email:' || requested_email_fingerprint, 0)
  );
  if requested_network_fingerprint is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'hq-network:' || requested_network_fingerprint,
        0
      )
    );
  end if;

  select count(*)::integer into email_attempts
  from public.hq_magic_link_request_events event
  where event.email_fingerprint = requested_email_fingerprint
    and event.decision = 'allowed'
    and event.occurred_at >= pg_catalog.now()
      - pg_catalog.make_interval(secs => requested_window_seconds);

  if requested_network_fingerprint is not null then
    select count(*)::integer into network_attempts
    from public.hq_magic_link_request_events event
    where event.network_fingerprint = requested_network_fingerprint
      and event.decision = 'allowed'
      and event.occurred_at >= pg_catalog.now()
        - pg_catalog.make_interval(secs => requested_window_seconds);
  end if;

  next_allowed := email_attempts < requested_email_limit
    and (
      requested_network_fingerprint is null
      or network_attempts < requested_network_limit
    );

  if next_allowed then
    insert into public.hq_magic_link_request_events (
      id,
      email_fingerprint,
      network_fingerprint,
      decision
    ) values (
      next_request_id,
      requested_email_fingerprint,
      requested_network_fingerprint,
      'allowed'
    );
  else
    -- Preserve immutable evidence that a limit was reached without allowing a
    -- rejected-request flood to append one row forever. The advisory locks
    -- make this one marker per matching email/network window under concurrency.
    select event.id into next_request_id
    from public.hq_magic_link_request_events event
    where event.decision = 'rate_limited'
      and event.occurred_at >= pg_catalog.now()
        - pg_catalog.make_interval(secs => requested_window_seconds)
      and (
        event.email_fingerprint = requested_email_fingerprint
        or (
          requested_network_fingerprint is not null
          and event.network_fingerprint = requested_network_fingerprint
        )
      )
    order by event.occurred_at desc
    limit 1;

    if next_request_id is null then
      next_request_id := pg_catalog.gen_random_uuid();
      insert into public.hq_magic_link_request_events (
        id,
        email_fingerprint,
        network_fingerprint,
        decision
      ) values (
        next_request_id,
        requested_email_fingerprint,
        requested_network_fingerprint,
        'rate_limited'
      );
    end if;
  end if;

  return query select next_request_id, next_allowed;
end;
$$;

revoke all on function public.reserve_hq_magic_link_request(
  text, text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.reserve_hq_magic_link_request(
  text, text, integer, integer, integer
) to service_role;

create or replace function public.save_jobber_connection_with_event(
  requested_account_id text,
  requested_account_name text,
  requested_access_token_ciphertext text,
  requested_refresh_token_ciphertext text,
  requested_access_token_expires_at timestamptz,
  requested_graphql_version text,
  requested_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing_account_id text;
  connection_exists boolean := false;
  connection_event_type text;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_account_id is null or pg_catalog.btrim(requested_account_id) = ''
    or requested_account_name is null or pg_catalog.btrim(requested_account_name) = ''
    or requested_access_token_ciphertext is null
    or pg_catalog.btrim(requested_access_token_ciphertext) = ''
    or requested_refresh_token_ciphertext is null
    or pg_catalog.btrim(requested_refresh_token_ciphertext) = ''
    or requested_access_token_expires_at is null
    or requested_graphql_version is null
    or pg_catalog.btrim(requested_graphql_version) = ''
    or requested_actor_id is null
  then
    raise exception 'Invalid Jobber connection persistence input';
  end if;

  select connection.account_id
  into existing_account_id
  from public.jobber_connections connection
  where connection.id = 'squeegeeking'
  for update;
  connection_exists := found;

  if connection_exists and existing_account_id <> requested_account_id then
    raise exception 'A different Jobber account is already connected';
  end if;

  if connection_exists then
    update public.jobber_connections
    set status = 'connected',
        account_id = requested_account_id,
        account_name = requested_account_name,
        access_token_ciphertext = requested_access_token_ciphertext,
        refresh_token_ciphertext = requested_refresh_token_ciphertext,
        access_token_expires_at = requested_access_token_expires_at,
        token_generation = token_generation + 1,
        graphql_version = requested_graphql_version,
        last_verified_at = changed_at,
        last_error_code = null,
        refresh_lease_id = null,
        refresh_lease_expires_at = null
    where id = 'squeegeeking';
    connection_event_type := 'reauthorized';
  else
    insert into public.jobber_connections (
      id,
      status,
      account_id,
      account_name,
      access_token_ciphertext,
      refresh_token_ciphertext,
      access_token_expires_at,
      token_generation,
      graphql_version,
      connected_at,
      last_verified_at
    ) values (
      'squeegeeking',
      'connected',
      requested_account_id,
      requested_account_name,
      requested_access_token_ciphertext,
      requested_refresh_token_ciphertext,
      requested_access_token_expires_at,
      1,
      requested_graphql_version,
      changed_at,
      changed_at
    );
    connection_event_type := 'connected';
  end if;

  insert into public.jobber_connection_events (
    connection_id,
    event_type,
    actor,
    safe_details
  ) values (
    'squeegeeking',
    connection_event_type,
    requested_actor_id::text,
    pg_catalog.jsonb_build_object(
      'account_id', requested_account_id,
      'account_name', requested_account_name,
      'graphql_version', requested_graphql_version
    )
  );
end;
$$;

revoke all on function public.save_jobber_connection_with_event(
  text, text, text, text, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.save_jobber_connection_with_event(
  text, text, text, text, timestamptz, text, uuid
) to service_role;

create or replace function public.acquire_jobber_refresh_lease_for_generation(
  requested_lease_id uuid,
  requested_token_generation bigint,
  lease_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed integer;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_lease_id is null
    or requested_token_generation is null
    or requested_token_generation < 1
    or lease_seconds < 5
    or lease_seconds > 120
  then
    return false;
  end if;

  update public.jobber_connections
  set refresh_lease_id = requested_lease_id,
      refresh_lease_expires_at = changed_at
        + pg_catalog.make_interval(secs => lease_seconds)
  where id = 'squeegeeking'
    and status = 'connected'
    and token_generation = requested_token_generation
    and (
      refresh_lease_id is null
      or refresh_lease_expires_at is null
      or refresh_lease_expires_at <= changed_at
    );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.acquire_jobber_refresh_lease_for_generation(
  uuid, bigint, integer
) from public, anon, authenticated;
grant execute on function public.acquire_jobber_refresh_lease_for_generation(
  uuid, bigint, integer
) to service_role;

create or replace function public.complete_jobber_refresh_with_event(
  requested_lease_id uuid,
  requested_token_generation bigint,
  requested_access_token_ciphertext text,
  requested_refresh_token_ciphertext text,
  requested_access_token_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed integer;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_lease_id is null
    or requested_token_generation is null
    or requested_token_generation < 1
    or requested_access_token_ciphertext is null
    or pg_catalog.btrim(requested_access_token_ciphertext) = ''
    or requested_refresh_token_ciphertext is null
    or pg_catalog.btrim(requested_refresh_token_ciphertext) = ''
    or requested_access_token_expires_at is null
  then
    raise exception 'Invalid Jobber refresh completion input';
  end if;

  update public.jobber_connections
  set status = 'connected',
      access_token_ciphertext = requested_access_token_ciphertext,
      refresh_token_ciphertext = requested_refresh_token_ciphertext,
      access_token_expires_at = requested_access_token_expires_at,
      token_generation = requested_token_generation + 1,
      last_refreshed_at = changed_at,
      last_error_code = null,
      refresh_lease_id = null,
      refresh_lease_expires_at = null
  where id = 'squeegeeking'
    and status = 'connected'
    and refresh_lease_id = requested_lease_id
    and refresh_lease_expires_at > changed_at
    and token_generation = requested_token_generation;
  get diagnostics changed = row_count;

  if changed = 0 then
    return false;
  end if;

  insert into public.jobber_connection_events (
    connection_id,
    event_type,
    actor,
    safe_details
  ) values (
    'squeegeeking',
    'refreshed',
    'homeatlas_token_manager',
    pg_catalog.jsonb_build_object(
      'token_generation', requested_token_generation + 1
    )
  );

  return true;
end;
$$;

revoke all on function public.complete_jobber_refresh_with_event(
  uuid, bigint, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_jobber_refresh_with_event(
  uuid, bigint, text, text, timestamptz
) to service_role;

create or replace function public.fail_jobber_refresh_with_event(
  requested_lease_id uuid,
  requested_token_generation bigint,
  requested_reauthorization_required boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  changed integer;
  changed_at timestamptz := pg_catalog.now();
begin
  if requested_lease_id is null
    or requested_token_generation is null
    or requested_token_generation < 1
    or requested_reauthorization_required is null
  then
    raise exception 'Invalid Jobber refresh failure input';
  end if;

  update public.jobber_connections
  set status = case
        when requested_reauthorization_required then 'refresh_required'
        else 'connected'
      end,
      last_error_code = case
        when requested_reauthorization_required
          then 'jobber_reauthorization_required'
        else 'jobber_refresh_failed'
      end,
      refresh_lease_id = null,
      refresh_lease_expires_at = null
  where id = 'squeegeeking'
    and status = 'connected'
    and refresh_lease_id = requested_lease_id
    and refresh_lease_expires_at > changed_at
    and token_generation = requested_token_generation;
  get diagnostics changed = row_count;

  if changed = 0 then
    return false;
  end if;

  insert into public.jobber_connection_events (
    connection_id,
    event_type,
    actor,
    safe_details
  ) values (
    'squeegeeking',
    'refresh_failed',
    'homeatlas_token_manager',
    pg_catalog.jsonb_build_object(
      'reason', case
        when requested_reauthorization_required
          then 'reauthorization_required'
        else 'transient_refresh_failure'
      end,
      'token_generation', requested_token_generation
    )
  );

  return true;
end;
$$;

revoke all on function public.fail_jobber_refresh_with_event(
  uuid, bigint, boolean
) from public, anon, authenticated;
grant execute on function public.fail_jobber_refresh_with_event(
  uuid, bigint, boolean
) to service_role;

comment on table public.hq_admin_users is
  'Explicit Headquarters authorization records keyed to Supabase Auth users; no automatic approvals';
comment on table public.hq_admin_user_events is
  'Append-only authorization evidence for Headquarters grants, revocations, role, active, and email changes';
comment on table public.hq_magic_link_request_events is
  'Append-only, HMAC-pseudonymized, database-backed magic-link limiter decisions';
