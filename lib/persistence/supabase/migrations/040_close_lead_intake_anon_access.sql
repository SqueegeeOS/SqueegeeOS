-- Migration 040: make submitted quote requests server-only.
--
-- Migration 009 originally allowed anonymous access to every lead_intakes
-- operation so the browser could submit the public request form directly.
-- The application now writes through POST /api/leads with the service role,
-- so public table privileges are no longer required and expose customer PII.

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_intakes'
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

revoke all privileges on table public.lead_intakes
  from public, anon, authenticated;
grant select, insert, update, delete on table public.lead_intakes
  to service_role;

-- Keep the durable security posture RPC authoritative for every table that
-- contains customer identity, contact, property, agreement, or plan data.
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
      ('lead_intakes')
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

comment on table public.lead_intakes is
  'Private quote-request inbox; public submissions enter through POST /api/leads only.';
