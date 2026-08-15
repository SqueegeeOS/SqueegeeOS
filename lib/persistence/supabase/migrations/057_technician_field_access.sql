-- Least-privilege technician access. HQ issues a short-lived, one-time invite;
-- the technician's phone exchanges it for a separate revocable field session.
-- Only SHA-256 hashes are stored. No field credential can authorize HQ routes.

begin;

create table if not exists public.technician_access_grants (
  id uuid primary key default gen_random_uuid(),
  jobber_user_id text not null,
  display_name text not null,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'revoked')
  ),
  invite_token_hash text not null unique,
  invite_expires_at timestamptz not null,
  session_token_hash text unique,
  session_expires_at timestamptz,
  claimed_at timestamptz,
  issued_by text not null,
  revoked_at timestamptz,
  revoked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(jobber_user_id), '') is not null),
  check (length(jobber_user_id) <= 255),
  check (nullif(trim(display_name), '') is not null),
  check (length(display_name) <= 80),
  check (nullif(trim(issued_by), '') is not null),
  check (length(issued_by) <= 80),
  check (invite_token_hash ~ '^[0-9a-f]{64}$'),
  check (
    session_token_hash is null
    or session_token_hash ~ '^[0-9a-f]{64}$'
  ),
  check (invite_expires_at > created_at),
  check (
    (status = 'pending'
      and session_token_hash is null
      and session_expires_at is null
      and claimed_at is null
      and revoked_at is null
      and revoked_by is null)
    or
    (status = 'active'
      and session_token_hash is not null
      and session_expires_at is not null
      and claimed_at is not null
      and session_expires_at > claimed_at
      and revoked_at is null
      and revoked_by is null)
    or
    (status = 'revoked'
      and revoked_at is not null
      and nullif(trim(coalesce(revoked_by, '')), '') is not null)
  )
);

create unique index if not exists technician_access_grants_current_user_uidx
  on public.technician_access_grants(jobber_user_id)
  where status in ('pending', 'active');
create index if not exists technician_access_grants_session_lookup_idx
  on public.technician_access_grants(session_token_hash, session_expires_at)
  where status = 'active';
create index if not exists technician_access_grants_roster_idx
  on public.technician_access_grants(created_at desc);

drop trigger if exists technician_access_grants_updated_at
  on public.technician_access_grants;
create trigger technician_access_grants_updated_at
  before update on public.technician_access_grants
  for each row execute function public.set_updated_at();

alter table public.technician_access_grants enable row level security;

revoke all privileges on table public.technician_access_grants
  from public, anon, authenticated;
grant select, insert, update, delete on table public.technician_access_grants
  to service_role;

create or replace function public.issue_technician_access_grant(
  p_jobber_user_id text,
  p_display_name text,
  p_invite_token_hash text,
  p_invite_expires_at timestamptz,
  p_issued_by text
)
returns table(grant_id uuid, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_user_id text := trim(coalesce(p_jobber_user_id, ''));
  normalized_name text := trim(coalesce(p_display_name, ''));
  normalized_issuer text := trim(coalesce(p_issued_by, ''));
  created_grant_id uuid;
  created_invite_expires_at timestamptz;
begin
  if normalized_user_id = ''
     or length(normalized_user_id) > 255
     or normalized_name = ''
     or length(normalized_name) > 80
     or p_invite_token_hash !~ '^[0-9a-f]{64}$'
     or p_invite_expires_at <= now()
     or p_invite_expires_at > now() + interval '25 hours'
     or normalized_issuer = ''
     or length(normalized_issuer) > 80 then
    raise exception 'Invalid technician field-pass request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_user_id, 0));

  update public.technician_access_grants
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = normalized_issuer
  where jobber_user_id = normalized_user_id
    and status in ('pending', 'active');

  insert into public.technician_access_grants (
    jobber_user_id,
    display_name,
    invite_token_hash,
    invite_expires_at,
    issued_by
  )
  values (
    normalized_user_id,
    normalized_name,
    p_invite_token_hash,
    p_invite_expires_at,
    normalized_issuer
  )
  returning id, technician_access_grants.invite_expires_at
    into created_grant_id, created_invite_expires_at;

  return query select created_grant_id, created_invite_expires_at;
end;
$$;

revoke all on function public.issue_technician_access_grant(
  text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.issue_technician_access_grant(
  text, text, text, timestamptz, text
) to service_role;

create or replace function public.claim_technician_access_grant(
  p_invite_token_hash text,
  p_session_token_hash text,
  p_session_expires_at timestamptz
)
returns table(
  grant_id uuid,
  jobber_user_id text,
  display_name text,
  session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_grant_id uuid;
  claimed_jobber_user_id text;
  claimed_display_name text;
  claimed_session_expires_at timestamptz;
begin
  if p_invite_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_expires_at <= now()
     or p_session_expires_at > now() + interval '31 days' then
    raise exception 'Invalid technician field-pass claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_invite_token_hash, 0));

  update public.technician_access_grants grant_row
  set status = 'active',
      session_token_hash = p_session_token_hash,
      session_expires_at = p_session_expires_at,
      claimed_at = now()
  where grant_row.invite_token_hash = p_invite_token_hash
    and grant_row.status = 'pending'
    and grant_row.claimed_at is null
    and grant_row.invite_expires_at > now()
  returning grant_row.id,
    grant_row.jobber_user_id,
    grant_row.display_name,
    grant_row.session_expires_at
  into claimed_grant_id,
    claimed_jobber_user_id,
    claimed_display_name,
    claimed_session_expires_at;

  if claimed_grant_id is null then
    raise exception 'Technician field-pass invite is invalid or expired';
  end if;

  return query select
    claimed_grant_id,
    claimed_jobber_user_id,
    claimed_display_name,
    claimed_session_expires_at;
end;
$$;

revoke all on function public.claim_technician_access_grant(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_technician_access_grant(
  text, text, timestamptz
) to service_role;

create or replace function public.revoke_technician_access_grant(
  p_grant_id uuid,
  p_revoked_by text
)
returns table(grant_id uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_actor text := trim(coalesce(p_revoked_by, ''));
  resolved_grant_id uuid;
  resolved_revoked_at timestamptz;
begin
  if p_grant_id is null
     or normalized_actor = ''
     or length(normalized_actor) > 80 then
    raise exception 'Invalid technician field-pass revocation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_grant_id::text, 0));

  update public.technician_access_grants grant_row
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = normalized_actor
  where grant_row.id = p_grant_id
    and grant_row.status in ('pending', 'active')
  returning grant_row.id, grant_row.revoked_at
    into resolved_grant_id, resolved_revoked_at;

  if resolved_grant_id is null then
    select grant_row.id, grant_row.revoked_at
      into resolved_grant_id, resolved_revoked_at
    from public.technician_access_grants grant_row
    where grant_row.id = p_grant_id
      and grant_row.status = 'revoked';
  end if;

  if resolved_grant_id is null or resolved_revoked_at is null then
    raise exception 'Technician field pass not found';
  end if;

  return query select resolved_grant_id, resolved_revoked_at;
end;
$$;

revoke all on function public.revoke_technician_access_grant(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_technician_access_grant(uuid, text)
  to service_role;

comment on table public.technician_access_grants is
  'Revocable least-privilege Field Passes tied to mirrored Jobber user identity; raw invite and session tokens are never stored.';

-- Keep the privacy probe complete as field identity joins customer operations.
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
      ('technician_access_grants')
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
