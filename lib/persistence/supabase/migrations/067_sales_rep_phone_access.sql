-- Migration 067: revocable, least-privilege phone access for field sales reps.
-- HQ issues a short-lived one-time link. The rep's phone exchanges it for a
-- separate 30-day session tied to one active sales_reps row. Only SHA-256
-- hashes are stored, and no sales credential can authorize founder HQ routes.

begin;

create table if not exists public.sales_rep_access_grants (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
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

create unique index if not exists sales_rep_access_grants_current_rep_uidx
  on public.sales_rep_access_grants(rep_id)
  where status in ('pending', 'active');
create index if not exists sales_rep_access_grants_session_lookup_idx
  on public.sales_rep_access_grants(session_token_hash, session_expires_at)
  where status = 'active';
create index if not exists sales_rep_access_grants_created_idx
  on public.sales_rep_access_grants(created_at desc);

drop trigger if exists sales_rep_access_grants_updated_at
  on public.sales_rep_access_grants;
create trigger sales_rep_access_grants_updated_at
  before update on public.sales_rep_access_grants
  for each row execute function public.set_updated_at();

alter table public.sales_rep_access_grants enable row level security;

revoke all privileges on table public.sales_rep_access_grants
  from public, anon, authenticated;
grant select, insert, update, delete on table public.sales_rep_access_grants
  to service_role;

create or replace function public.issue_sales_rep_access_grant(
  p_rep_id uuid,
  p_invite_token_hash text,
  p_invite_expires_at timestamptz,
  p_issued_by text
)
returns table(
  grant_id uuid,
  rep_slug text,
  display_name text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_issuer text := trim(coalesce(p_issued_by, ''));
  resolved_slug text;
  resolved_name text;
  created_grant_id uuid;
  created_invite_expires_at timestamptz;
begin
  if p_rep_id is null
     or p_invite_token_hash !~ '^[0-9a-f]{64}$'
     or p_invite_expires_at <= now()
     or p_invite_expires_at > now() + interval '25 hours'
     or normalized_issuer = ''
     or length(normalized_issuer) > 80 then
    raise exception 'Invalid sales phone-pass request';
  end if;

  select rep.slug, rep.display_name
    into resolved_slug, resolved_name
  from public.sales_reps rep
  where rep.id = p_rep_id
    and rep.status = 'active';

  if resolved_slug is null or resolved_name is null then
    raise exception 'Sales representative is not active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_rep_id::text, 0));

  update public.sales_rep_access_grants
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = normalized_issuer
  where rep_id = p_rep_id
    and status in ('pending', 'active');

  insert into public.sales_rep_access_grants (
    rep_id,
    invite_token_hash,
    invite_expires_at,
    issued_by
  )
  values (
    p_rep_id,
    p_invite_token_hash,
    p_invite_expires_at,
    normalized_issuer
  )
  returning id, sales_rep_access_grants.invite_expires_at
    into created_grant_id, created_invite_expires_at;

  return query select
    created_grant_id,
    resolved_slug,
    resolved_name,
    created_invite_expires_at;
end;
$$;

revoke all on function public.issue_sales_rep_access_grant(
  uuid, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.issue_sales_rep_access_grant(
  uuid, text, timestamptz, text
) to service_role;

create or replace function public.claim_sales_rep_access_grant(
  p_invite_token_hash text,
  p_session_token_hash text,
  p_session_expires_at timestamptz
)
returns table(
  grant_id uuid,
  rep_id uuid,
  rep_slug text,
  display_name text,
  session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_grant_id uuid;
  claimed_rep_id uuid;
  claimed_rep_slug text;
  claimed_display_name text;
  claimed_session_expires_at timestamptz;
begin
  if p_invite_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_expires_at <= now()
     or p_session_expires_at > now() + interval '31 days' then
    raise exception 'Invalid sales phone-pass claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_invite_token_hash, 0));

  update public.sales_rep_access_grants grant_row
  set status = 'active',
      session_token_hash = p_session_token_hash,
      session_expires_at = p_session_expires_at,
      claimed_at = now()
  from public.sales_reps rep
  where grant_row.invite_token_hash = p_invite_token_hash
    and grant_row.status = 'pending'
    and grant_row.claimed_at is null
    and grant_row.invite_expires_at > now()
    and rep.id = grant_row.rep_id
    and rep.status = 'active'
  returning grant_row.id,
    grant_row.rep_id,
    rep.slug,
    rep.display_name,
    grant_row.session_expires_at
  into claimed_grant_id,
    claimed_rep_id,
    claimed_rep_slug,
    claimed_display_name,
    claimed_session_expires_at;

  if claimed_grant_id is null then
    raise exception 'Sales phone-pass invite is invalid or expired';
  end if;

  return query select
    claimed_grant_id,
    claimed_rep_id,
    claimed_rep_slug,
    claimed_display_name,
    claimed_session_expires_at;
end;
$$;

revoke all on function public.claim_sales_rep_access_grant(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_sales_rep_access_grant(
  text, text, timestamptz
) to service_role;

create or replace function public.revoke_sales_rep_access_grant(
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
    raise exception 'Invalid sales phone-pass revocation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_grant_id::text, 0));

  update public.sales_rep_access_grants grant_row
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
    from public.sales_rep_access_grants grant_row
    where grant_row.id = p_grant_id
      and grant_row.status = 'revoked';
  end if;

  if resolved_grant_id is null or resolved_revoked_at is null then
    raise exception 'Sales phone pass not found';
  end if;

  return query select resolved_grant_id, resolved_revoked_at;
end;
$$;

revoke all on function public.revoke_sales_rep_access_grant(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_sales_rep_access_grant(uuid, text)
  to service_role;

comment on table public.sales_rep_access_grants is
  'Revocable least-privilege phone sessions tied to one active sales representative; raw invite and session tokens are never stored.';

-- Keep the privacy probe complete as sales identity gains scoped access to
-- presentations, signatures, and enrollment handoff.
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
