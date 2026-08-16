-- Migration 079: make field homeowner capture one durable operation even when
-- a mobile response is lost and the representative retries the same save.
-- The database derives the lead-captured activity and Door Memory binding in
-- the same transaction as the lead row; no message, enrollment, or charge is
-- performed here.

begin;

alter table public.sales_rep_leads
  add column if not exists client_event_id uuid,
  add column if not exists capture_fingerprint text,
  add column if not exists door_memory_client_event_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_rep_leads'::regclass
      and conname = 'sales_rep_leads_capture_fingerprint_check'
  ) then
    alter table public.sales_rep_leads
      add constraint sales_rep_leads_capture_fingerprint_check
      check (
        (client_event_id is null and capture_fingerprint is null)
        or
        (
          client_event_id is not null
          and capture_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
  end if;
end
$$;

create unique index if not exists sales_rep_leads_rep_client_event_uidx
  on public.sales_rep_leads(rep_id, client_event_id)
  where client_event_id is not null;

create unique index if not exists sales_rep_leads_rep_door_memory_uidx
  on public.sales_rep_leads(rep_id, door_memory_client_event_id)
  where door_memory_client_event_id is not null;

create or replace function public.homeatlas_record_sales_lead_capture()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- During a migration-first rollout, the previous application version still
  -- writes null here and keeps its existing evidence path. The new version
  -- always supplies a device UUID and uses this atomic path.
  if new.client_event_id is null then
    return new;
  end if;

  insert into public.sales_rep_activity_events (
    rep_id,
    lead_id,
    event_type,
    quantity,
    source_path,
    safe_details,
    client_event_id,
    occurred_at
  ) values (
    new.rep_id,
    new.id,
    'lead_captured',
    1,
    '/sales/lead-capture',
    jsonb_build_object(
      'derived_from', 'sales_rep_lead',
      'lead_id', new.id
    ),
    new.client_event_id,
    new.created_at
  );

  if new.door_memory_client_event_id is not null then
    update public.sales_rep_door_visits
    set lead_id = new.id
    where rep_id = new.rep_id
      and client_event_id = new.door_memory_client_event_id
      and lead_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists sales_rep_leads_record_capture
  on public.sales_rep_leads;
create trigger sales_rep_leads_record_capture
  after insert on public.sales_rep_leads
  for each row
  execute function public.homeatlas_record_sales_lead_capture();

-- Trigger-only: it runs with the already-authorized server writer's narrow
-- privileges and cannot be called as a browser-facing RPC.
revoke all on function public.homeatlas_record_sales_lead_capture()
  from public, anon, authenticated, service_role;

comment on column public.sales_rep_leads.client_event_id is
  'Device-generated UUID that makes one field capture safe to retry';
comment on column public.sales_rep_leads.capture_fingerprint is
  'SHA-256 proof of the normalized initial capture for exact retry matching';
comment on column public.sales_rep_leads.door_memory_client_event_id is
  'Optional Door Memory client UUID bound atomically when the lead is created';
comment on function public.homeatlas_record_sales_lead_capture() is
  'Trigger-only derivation of one lead-captured activity and optional Door Memory binding';

commit;
