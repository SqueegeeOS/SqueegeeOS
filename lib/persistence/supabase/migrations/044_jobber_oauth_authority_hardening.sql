-- Harden Jobber OAuth account authority, transaction-of-use actor authority,
-- and exact lost-response replay without rewriting rehearsed migration 035.
-- Existing connection and immutable event rows are preserved.

begin;

do $$
begin
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Migration 044 requires extensions.digest(bytea,text) from pgcrypto';
  end if;
end;
$$;

alter table public.jobber_connection_events
  add column if not exists oauth_operation_id uuid;

do $$
declare
  column_count integer;
begin
  select pg_catalog.count(*)::integer
  into column_count
  from information_schema.columns column_info
  where column_info.table_schema = 'public'
    and column_info.table_name = 'jobber_connection_events'
    and column_info.column_name = 'oauth_operation_id'
    and column_info.data_type = 'uuid'
    and column_info.udt_name = 'uuid'
    and column_info.is_nullable = 'YES'
    and column_info.column_default is null;

  if column_count <> 1 then
    raise exception 'Migration 044 found an incompatible oauth_operation_id column';
  end if;
end;
$$;

create unique index if not exists jobber_connection_events_oauth_operation_uidx
  on public.jobber_connection_events using btree (oauth_operation_id)
  where oauth_operation_id is not null;

do $$
declare
  index_count integer;
begin
  select pg_catalog.count(*)::integer
  into index_count
  from pg_catalog.pg_index index_info
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_info.indexrelid
  join pg_catalog.pg_namespace index_namespace
    on index_namespace.oid = index_relation.relnamespace
  join pg_catalog.pg_class table_relation
    on table_relation.oid = index_info.indrelid
  join pg_catalog.pg_namespace table_namespace
    on table_namespace.oid = table_relation.relnamespace
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'jobber_connection_events_oauth_operation_uidx'
    and table_namespace.nspname = 'public'
    and table_relation.relname = 'jobber_connection_events'
    and index_info.indisunique
    and index_info.indisvalid
    and index_info.indisready
    and index_info.indnkeyatts = 1
    and index_info.indnatts = 1
    and pg_catalog.pg_get_indexdef(index_info.indexrelid) =
      'CREATE UNIQUE INDEX jobber_connection_events_oauth_operation_uidx ON public.jobber_connection_events USING btree (oauth_operation_id) WHERE (oauth_operation_id IS NOT NULL)';

  if index_count <> 1 then
    raise exception 'Migration 044 found an incompatible OAuth operation index';
  end if;
end;
$$;

-- Remove both the migration-035 contract and the unpublished caller-digest
-- overload. The replacement signature accepts no self-attested digest.
drop function if exists public.save_jobber_connection_with_event(
  text, text, text, text, timestamptz, text, uuid
);
drop function if exists public.save_jobber_connection_with_event(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid
);

create or replace function public.save_jobber_connection_with_event(
  requested_operation_id uuid,
  requested_expected_account_id text,
  requested_account_id text,
  requested_account_name text,
  requested_access_token_ciphertext text,
  requested_refresh_token_ciphertext text,
  requested_access_token_expires_at timestamptz,
  requested_graphql_version text,
  requested_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing_account_id text;
  connection_exists boolean := false;
  connection_event_type text;
  changed_at timestamptz := pg_catalog.now();
  computed_payload_sha256 text;
  replay_connection_id text;
  replay_event_type text;
  replay_actor text;
  replay_safe_details jsonb;
begin
  if requested_operation_id is null
    or requested_expected_account_id is null
    or pg_catalog.btrim(requested_expected_account_id) = ''
    or requested_account_id is null
    or pg_catalog.btrim(requested_account_id) = ''
    or requested_account_name is null
    or pg_catalog.btrim(requested_account_name) = ''
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

  if requested_expected_account_id <> requested_account_id then
    raise exception 'Jobber account identity did not match configured authority';
  end if;

  computed_payload_sha256 := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_array(
          'jobber_oauth_connection_v1',
          requested_operation_id::text,
          requested_expected_account_id,
          requested_account_id,
          requested_account_name,
          requested_access_token_ciphertext,
          requested_refresh_token_ciphertext,
          pg_catalog.to_char(
            requested_access_token_expires_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          requested_graphql_version,
          requested_actor_id::text
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  -- Serialize an operation before reading immutable evidence. Exact committed
  -- replay converges even if the original actor is now inactive or absent.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jobber-oauth-operation:' || requested_operation_id::text,
      0
    )
  );

  select event.connection_id, event.event_type, event.actor, event.safe_details
  into replay_connection_id, replay_event_type, replay_actor, replay_safe_details
  from public.jobber_connection_events event
  where event.oauth_operation_id = requested_operation_id;

  if found then
    if replay_connection_id = 'squeegeeking'
      and replay_event_type in ('connected', 'reauthorized')
      and replay_actor = requested_actor_id::text
      and replay_safe_details = pg_catalog.jsonb_build_object(
        'payload_sha256', computed_payload_sha256
      )
    then
      return 'replay';
    end if;

    raise exception 'Jobber OAuth operation replay payload conflict';
  end if;

  -- A new mutation must hold the exact actor row against concurrent active,
  -- role, or deletion changes until connection state and evidence commit.
  perform 1
  from public.hq_admin_users actor
  where actor.user_id = requested_actor_id
    and actor.active is true
    and actor.role in ('owner', 'operator')
  for share;

  if not found then
    raise exception 'Jobber connection actor is not an active owner or operator';
  end if;

  -- A table row cannot serialize the first insert, so use one transaction
  -- advisory lock for the singleton SqueegeeKing connection.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('jobber-connection:squeegeeking', 0)
  );

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
    safe_details,
    occurred_at,
    oauth_operation_id
  ) values (
    'squeegeeking',
    connection_event_type,
    requested_actor_id::text,
    pg_catalog.jsonb_build_object('payload_sha256', computed_payload_sha256),
    changed_at,
    requested_operation_id
  );

  return connection_event_type;
end;
$$;

revoke all on function public.save_jobber_connection_with_event(
  uuid, text, text, text, text, text, timestamptz, text, uuid
) from public, anon, authenticated, service_role;

-- CREATE OR REPLACE preserves an existing function ACL. Remove any other
-- non-owner grants left by an unreleased rehearsal before installing the exact
-- service-role-only contract. This remains invisible until transaction commit.
do $$
declare
  grantee_name text;
begin
  for grantee_name in
    select distinct grantee_role.rolname
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace procedure_namespace
      on procedure_namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) acl
    join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
    where procedure_namespace.nspname = 'public'
      and procedure.proname = 'save_jobber_connection_with_event'
      and pg_catalog.oidvectortypes(procedure.proargtypes) =
        'uuid, text, text, text, text, text, timestamp with time zone, text, uuid'
      and acl.grantee <> procedure.proowner
  loop
    execute pg_catalog.format(
      'revoke all on function public.save_jobber_connection_with_event(uuid, text, text, text, text, text, timestamptz, text, uuid) from %I',
      grantee_name
    );
  end loop;
end;
$$;

grant execute on function public.save_jobber_connection_with_event(
  uuid, text, text, text, text, text, timestamptz, text, uuid
) to service_role;

alter table public.jobber_connections enable row level security;
alter table public.jobber_connection_events enable row level security;
revoke all on table public.jobber_connections
  from public, anon, authenticated;
revoke all on table public.jobber_connection_events
  from public, anon, authenticated;

do $$
declare
  function_count integer;
  function_acl_count integer;
  exact_function_acl_count integer;
  browser_grant_count integer;
  browser_policy_count integer;
  trigger_count integer;
begin
  select pg_catalog.count(*)::integer
  into function_count
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace procedure_namespace
    on procedure_namespace.oid = procedure.pronamespace
  where procedure_namespace.nspname = 'public'
    and procedure.proname = 'save_jobber_connection_with_event'
    and pg_catalog.oidvectortypes(procedure.proargtypes) =
      'uuid, text, text, text, text, text, timestamp with time zone, text, uuid';

  if function_count <> 1 or (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace procedure_namespace
      on procedure_namespace.oid = procedure.pronamespace
    where procedure_namespace.nspname = 'public'
      and procedure.proname = 'save_jobber_connection_with_event'
  ) <> 1 then
    raise exception 'Migration 044 found an incompatible Jobber save overload inventory';
  end if;

  select pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (
      where (
        acl.grantee = procedure.proowner
        and acl.privilege_type = 'EXECUTE'
        and not acl.is_grantable
      ) or (
        grantee_role.rolname = 'service_role'
        and acl.privilege_type = 'EXECUTE'
        and not acl.is_grantable
      )
    )::integer
  into function_acl_count, exact_function_acl_count
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace procedure_namespace
    on procedure_namespace.oid = procedure.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      procedure.proacl,
      pg_catalog.acldefault('f', procedure.proowner)
    )
  ) acl
  left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
  where procedure_namespace.nspname = 'public'
    and procedure.proname = 'save_jobber_connection_with_event'
    and pg_catalog.oidvectortypes(procedure.proargtypes) =
      'uuid, text, text, text, text, text, timestamp with time zone, text, uuid';

  if function_acl_count <> 2 or exact_function_acl_count <> 2 then
    raise exception 'Migration 044 found an incompatible Jobber save function ACL';
  end if;

  select pg_catalog.count(*)::integer
  into browser_grant_count
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace relation_namespace
    on relation_namespace.oid = relation.relnamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
  ) acl
  where relation_namespace.nspname = 'public'
    and relation.relname in ('jobber_connections', 'jobber_connection_events')
    and (
      acl.grantee = 0
      or pg_catalog.pg_has_role('anon', acl.grantee, 'MEMBER')
      or pg_catalog.pg_has_role('authenticated', acl.grantee, 'MEMBER')
    );

  if browser_grant_count <> 0 then
    raise exception 'Migration 044 found a browser Jobber connection table grant';
  end if;

  select pg_catalog.count(*)::integer
  into browser_policy_count
  from pg_catalog.pg_policy policy
  join pg_catalog.pg_class relation on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace relation_namespace
    on relation_namespace.oid = relation.relnamespace
  where relation_namespace.nspname = 'public'
    and relation.relname in ('jobber_connections', 'jobber_connection_events')
    and exists (
      select 1
      from pg_catalog.unnest(policy.polroles) policy_role(role_oid)
      where policy_role.role_oid = 0
        or pg_catalog.pg_has_role('anon', policy_role.role_oid, 'MEMBER')
        or pg_catalog.pg_has_role('authenticated', policy_role.role_oid, 'MEMBER')
    );

  if browser_policy_count <> 0 then
    raise exception 'Migration 044 found a browser Jobber connection policy';
  end if;

  select pg_catalog.count(*)::integer
  into trigger_count
  from pg_catalog.pg_trigger trigger_info
  join pg_catalog.pg_class relation on relation.oid = trigger_info.tgrelid
  join pg_catalog.pg_namespace relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc trigger_function
    on trigger_function.oid = trigger_info.tgfoid
  join pg_catalog.pg_namespace function_namespace
    on function_namespace.oid = trigger_function.pronamespace
  where relation_namespace.nspname = 'public'
    and relation.relname = 'jobber_connection_events'
    and trigger_info.tgname = 'jobber_connection_events_immutable'
    and not trigger_info.tgisinternal
    and trigger_info.tgtype::integer = 27
    and trigger_info.tgenabled = 'O'
    and function_namespace.nspname = 'public'
    and trigger_function.proname = 'reject_jobber_connection_event_change';

  if trigger_count <> 1 then
    raise exception 'Migration 044 requires the exact immutable Jobber event trigger';
  end if;
end;
$$;

comment on column public.jobber_connection_events.oauth_operation_id is
  'Server-generated OAuth operation UUID; unique immutable evidence for exact lost-response replay';

commit;
