-- Migration 073: remove browser-role RPC access from internal privileged
-- functions and prevent the same unsafe default from returning. These
-- functions are used only by service-role server code or database triggers.

begin;

-- Supabase projects may explicitly grant EXECUTE to anon/authenticated even
-- after PUBLIC has been revoked. Preserve the server-only Jobber lease path.
revoke execute on function public.acquire_jobber_refresh_lease(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.acquire_jobber_refresh_lease(uuid, integer)
  to service_role;

-- These trigger functions exist in production but are not required by every
-- fresh/local schema. Tighten them when present without making a clean replay
-- depend on out-of-band HQ admin bootstrap objects.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.record_hq_admin_user_change()',
    'public.sync_hq_admin_user_auth_email()',
    'public.validate_hq_admin_user_auth_email()'
  ]
  loop
    if to_regprocedure(function_signature) is not null then
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        function_signature
      );
      execute format(
        'grant execute on function %s to service_role',
        function_signature
      );
    end if;
  end loop;
end
$$;

-- New HomeAtlas functions created by the migration role should be private
-- until a migration explicitly grants the narrow role that needs them.
-- Hosted Supabase intentionally prevents app migrations from mutating the
-- platform-owned supabase_admin defaults.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
