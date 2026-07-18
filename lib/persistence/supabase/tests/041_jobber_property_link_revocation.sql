\set ON_ERROR_STOP on
-- Run only after migrations 001-041 on a disposable Supabase database.
-- The seeded functional RPC assertions run inside the migration-039 harness;
-- this companion proves the exact migration-041 catalog boundary. Both are
-- rollback-only. The two-session race remains a separately documented gate.
begin;

do $$
declare
  rpc regprocedure := to_regprocedure(
    'public.revoke_jobber_property_link(uuid,text,uuid,uuid,timestamp with time zone,text)'
  );
  definition text;
  rpc_owner oid;
begin
  if rpc is null then
    raise exception 'Migration 041 revocation RPC is missing';
  end if;
  if has_function_privilege('anon', rpc, 'EXECUTE')
    or has_function_privilege('authenticated', rpc, 'EXECUTE')
    or not has_function_privilege('service_role', rpc, 'EXECUTE')
  then
    raise exception 'Migration 041 revocation RPC privileges are unsafe';
  end if;
  select proowner into strict rpc_owner from pg_catalog.pg_proc where oid = rpc;
  if (
    select count(*)
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(
      pg_catalog.coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) function_acl
    where function_row.oid = rpc
      and function_acl.privilege_type = 'EXECUTE'
  ) <> 2 or exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(
      pg_catalog.coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) function_acl
    where function_row.oid = rpc
      and function_acl.privilege_type = 'EXECUTE'
      and function_acl.grantee not in (
        rpc_owner,
        (select oid from pg_catalog.pg_roles where rolname = 'service_role')
      )
  ) then
    raise exception 'Migration 041 revocation RPC ACL is not exact';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobber_property_links'
      and column_name = 'revocation_expected_link_updated_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobber_property_link_events'
      and column_name = 'revocation_projection_id'
  ) then
    raise exception 'Migration 041 replay evidence columns are missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('jobber_property_links', 'jobber_property_link_events')
      and relation.relrowsecurity
    group by namespace.nspname
    having count(*) = 2
  ) then
    raise exception 'Migration 041 authority tables must retain RLS';
  end if;
  select pg_catalog.pg_get_functiondef(rpc) into definition;
  if definition not like '%Revocation replay did not match%'
    or definition not like '%for update%'
    or definition like '%delete from%'
  then
    raise exception 'Migration 041 RPC definition is not fail closed';
  end if;
end;
$$;

rollback;
