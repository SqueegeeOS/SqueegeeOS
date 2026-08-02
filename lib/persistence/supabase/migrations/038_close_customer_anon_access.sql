-- Migration 038: close public customer-table access and add durable admin
-- unlock throttling.
--
-- Deployment order:
--   1. Deploy the application release that routes browser persistence through
--      authenticated server endpoints.
--   2. Apply this migration.
--   3. Run scripts/verify-supabase-security.mjs and the production smoke tests.
--
-- Safe to re-run: policy drops, grants, table creation, and functions are
-- idempotent.

-- ---------------------------------------------------------------------------
-- 1. Customer authority tables are server/service-role only
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (
        array[
          'homeowners',
          'properties',
          'home_care_plans',
          'memberships',
          'signed_agreements',
          'property_assets'
        ]
      )
      and (
        'anon' = any(roles)
        or 'authenticated' = any(roles)
        or 'public' = any(roles)
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

revoke all privileges on table public.homeowners from public, anon, authenticated;
revoke all privileges on table public.properties from public, anon, authenticated;
revoke all privileges on table public.home_care_plans from public, anon, authenticated;
revoke all privileges on table public.memberships from public, anon, authenticated;
revoke all privileges on table public.signed_agreements from public, anon, authenticated;
revoke all privileges on table public.property_assets from public, anon, authenticated;

grant select, insert, update, delete on table public.homeowners to service_role;
grant select, insert, update, delete on table public.properties to service_role;
grant select, insert, update, delete on table public.home_care_plans to service_role;
grant select, insert, update, delete on table public.memberships to service_role;
grant select, insert, update, delete on table public.signed_agreements to service_role;
grant select, insert, update, delete on table public.property_assets to service_role;

-- ---------------------------------------------------------------------------
-- 2. Durable rate-limit state for the public admin unlock endpoint
-- ---------------------------------------------------------------------------
create table if not exists public.admin_unlock_rate_limits (
  identity_hash text primary key,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_unlock_identity_hash_length
    check (char_length(identity_hash) between 32 and 128)
);

alter table public.admin_unlock_rate_limits enable row level security;
revoke all privileges on table public.admin_unlock_rate_limits
  from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_unlock_rate_limits
  to service_role;

drop trigger if exists admin_unlock_rate_limits_set_updated_at
  on public.admin_unlock_rate_limits;
create trigger admin_unlock_rate_limits_set_updated_at
before update on public.admin_unlock_rate_limits
for each row execute function public.set_updated_at();

create or replace function public.check_admin_unlock_rate_limit(
  p_identity_hash text
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lock timestamptz;
  current_time timestamptz := clock_timestamp();
begin
  select locked_until
    into current_lock
  from public.admin_unlock_rate_limits
  where identity_hash = p_identity_hash;

  if not found or current_lock is null or current_lock <= current_time then
    return query select true, 0;
    return;
  end if;

  return query
    select false, greatest(1, ceil(extract(epoch from (current_lock - current_time)))::integer);
end;
$$;

create or replace function public.record_admin_unlock_attempt(
  p_identity_hash text,
  p_succeeded boolean,
  p_max_failures integer default 5,
  p_window_seconds integer default 900,
  p_lock_seconds integer default 900
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.admin_unlock_rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
  next_failures integer;
  next_lock timestamptz;
begin
  if char_length(p_identity_hash) < 32
     or p_max_failures < 1
     or p_window_seconds < 1
     or p_lock_seconds < 1 then
    raise exception 'Invalid admin unlock rate-limit input';
  end if;

  if p_succeeded then
    delete from public.admin_unlock_rate_limits
    where identity_hash = p_identity_hash;
    return query select true, 0;
    return;
  end if;

  insert into public.admin_unlock_rate_limits (identity_hash)
  values (p_identity_hash)
  on conflict (identity_hash) do nothing;

  select *
    into attempt_row
  from public.admin_unlock_rate_limits
  where identity_hash = p_identity_hash
  for update;

  if attempt_row.locked_until is not null
     and attempt_row.locked_until > current_time then
    return query
      select false,
        greatest(
          1,
          ceil(extract(epoch from (attempt_row.locked_until - current_time)))::integer
        );
    return;
  end if;

  if attempt_row.window_started_at
     <= current_time - make_interval(secs => p_window_seconds) then
    attempt_row.window_started_at := current_time;
    attempt_row.failed_attempts := 0;
  end if;

  next_failures := attempt_row.failed_attempts + 1;
  next_lock := case
    when next_failures >= p_max_failures
      then current_time + make_interval(secs => p_lock_seconds)
    else null
  end;

  update public.admin_unlock_rate_limits
  set window_started_at = attempt_row.window_started_at,
      failed_attempts = next_failures,
      locked_until = next_lock,
      updated_at = current_time
  where identity_hash = p_identity_hash;

  if next_lock is not null then
    return query select false, p_lock_seconds;
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_admin_unlock_rate_limit(text)
  from public, anon, authenticated;
revoke all on function public.record_admin_unlock_attempt(text, boolean, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_admin_unlock_rate_limit(text)
  to service_role;
grant execute on function public.record_admin_unlock_attempt(text, boolean, integer, integer, integer)
  to service_role;

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
      ('property_assets')
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

comment on table public.admin_unlock_rate_limits is
  'Server-only failed-attempt state for the founder unlock endpoint.';
