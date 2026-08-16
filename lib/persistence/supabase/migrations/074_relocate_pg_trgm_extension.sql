-- Keep PostgreSQL extension-owned functions and operators out of the API-facing
-- public schema. Existing Jobber GIN indexes reference operator-class OIDs, so
-- relocating pg_trgm preserves both indexes and their query-planner behavior.

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension extension_record
    join pg_namespace extension_schema
      on extension_schema.oid = extension_record.extnamespace
    where extension_record.extname = 'pg_trgm'
      and extension_schema.nspname = 'public'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end;
$$;

