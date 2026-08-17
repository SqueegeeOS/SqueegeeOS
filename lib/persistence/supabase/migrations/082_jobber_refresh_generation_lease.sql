-- Prevent a webhook burst from redeeming an already-rotated Jobber refresh
-- token. The lease is granted only if the worker still holds the current token
-- generation it loaded before attempting the provider refresh.

create or replace function public.acquire_jobber_refresh_lease_v2(
  requested_lease_id uuid,
  expected_token_generation bigint,
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
  if requested_lease_id is null
    or expected_token_generation is null
    or expected_token_generation < 0
    or lease_seconds < 5
    or lease_seconds > 120
  then
    return false;
  end if;

  update public.jobber_connections
  set refresh_lease_id = requested_lease_id,
      refresh_lease_expires_at = now() + make_interval(secs => lease_seconds),
      updated_at = now()
  where id = 'squeegeeking'
    and status = 'connected'
    and token_generation = expected_token_generation
    and (
      refresh_lease_id is null
      or refresh_lease_expires_at is null
      or refresh_lease_expires_at <= now()
    );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke execute on function public.acquire_jobber_refresh_lease_v2(
  uuid, bigint, integer
) from public, anon, authenticated;
grant execute on function public.acquire_jobber_refresh_lease_v2(
  uuid, bigint, integer
) to service_role;

comment on function public.acquire_jobber_refresh_lease_v2(
  uuid, bigint, integer
) is
  'Serializes rotating Jobber token refreshes and rejects workers holding a stale token generation';
