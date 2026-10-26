-- Durable webhook batches share one account-wide worker across Vercel instances.
-- No Jobber writes, communications, billing, or customer settings are changed.
begin;

create table public.jobber_webhook_sync_leases (
  connection_id text primary key references public.jobber_connections(id) on delete restrict,
  lease_id uuid,
  expires_at timestamptz,
  check ((lease_id is null) = (expires_at is null))
);
alter table public.jobber_webhook_sync_leases enable row level security;
revoke all on public.jobber_webhook_sync_leases from public, anon, authenticated;
grant select, insert, update on public.jobber_webhook_sync_leases to service_role;

alter table public.jobber_webhook_events add column processing_lease_id uuid;

create or replace function public.claim_jobber_webhook_batch(p_lease_id uuid, p_account_id text)
returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  lease public.jobber_webhook_sync_leases%rowtype;
  batch jsonb;
begin
  if p_lease_id is null or nullif(trim(p_account_id), '') is null
     or not exists (select 1 from public.jobber_connections
       where id = 'squeegeeking' and account_id = p_account_id and status = 'connected') then
    raise exception 'Connected Jobber account required';
  end if;

  insert into public.jobber_webhook_sync_leases(connection_id)
  values ('squeegeeking') on conflict do nothing;
  select * into lease from public.jobber_webhook_sync_leases
  where connection_id = 'squeegeeking' for update;
  if lease.lease_id is not null and lease.lease_id <> p_lease_id
     and lease.expires_at > now() then
    return jsonb_build_object('acquired', false, 'events', '[]'::jsonb);
  end if;

  -- Grace exceeds the route's configured 300-second lifetime. Owner checks
  -- fence finalizers; provider/projection writes are not generation-fenced.
  update public.jobber_webhook_sync_leases
  set lease_id = p_lease_id, expires_at = now() + interval '330 seconds'
  where connection_id = 'squeegeeking';

  update public.jobber_webhook_events
  set status = 'ignored', error_code = 'account_mismatch', processed_at = now(), processing_lease_id = null
  where status in ('received', 'failed', 'processing')
    and account_id is not null and account_id <> p_account_id;

  with candidates as (
    select event_key from public.jobber_webhook_events
    where (account_id is null or account_id = p_account_id)
      and sync_scope in ('clients', 'visits', 'full')
      and (status in ('received', 'failed')
        or (status = 'processing' and updated_at < now() - interval '330 seconds'))
    order by received_at, event_key
    limit 1000
    for update
  ), claimed as (
    update public.jobber_webhook_events e
    set status = 'processing', processing_lease_id = p_lease_id,
        error_code = null, processed_at = null
    from candidates c where e.event_key = c.event_key
    returning e.event_key, e.sync_scope
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into batch from claimed;

  if jsonb_array_length(batch) = 0 then
    -- Release in the same transaction as the empty check. A delivery arriving
    -- during shutdown can then claim the worker, rather than losing its wakeup.
    update public.jobber_webhook_sync_leases set lease_id = null, expires_at = null
    where connection_id = 'squeegeeking' and lease_id = p_lease_id;
  end if;
  return jsonb_build_object('acquired', true, 'events', batch);
end;
$$;

create or replace function public.finish_jobber_webhook_batch(
  p_lease_id uuid, p_event_keys text[], p_sync_summary jsonb, p_error_code text
)
returns integer
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare changed integer;
begin
  -- Lock the same singleton row as claim; a late worker may never acknowledge
  -- events belonging to the replacement worker or a different account snapshot.
  perform 1 from public.jobber_webhook_sync_leases
  where connection_id = 'squeegeeking' and lease_id = p_lease_id and expires_at > now()
  for update;
  if not found then raise exception 'Jobber webhook lease lost'; end if;
  update public.jobber_webhook_events
  set status = case when p_error_code is null then 'processed' else 'failed' end,
      sync_summary = p_sync_summary, error_code = p_error_code,
      processed_at = now(), processing_lease_id = null
  where event_key = any(p_event_keys) and status = 'processing' and processing_lease_id = p_lease_id;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.claim_jobber_webhook_batch(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_jobber_webhook_batch(uuid, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_jobber_webhook_batch(uuid, text) to service_role;
grant execute on function public.finish_jobber_webhook_batch(uuid, text[], jsonb, text) to service_role;

commit;
