-- Migration 075: make a conversational doorstep outcome the single source of
-- truth for both private Door Memory and the representative's talk metric.
-- Retried memory writes remain idempotent because the door visit and derived
-- activity share one device-generated client event ID.

begin;

create or replace function public.homeatlas_record_door_conversation_activity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.disposition not in ('conversation', 'follow_up', 'interested') then
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
    new.lead_id,
    'conversation',
    1,
    '/sales/door-memory',
    jsonb_build_object(
      'derived_from', 'door_memory',
      'door_visit_id', new.id
    ),
    new.client_event_id,
    new.occurred_at
  );

  return new;
end;
$$;

drop trigger if exists sales_rep_door_visits_record_conversation
  on public.sales_rep_door_visits;
create trigger sales_rep_door_visits_record_conversation
  after insert on public.sales_rep_door_visits
  for each row
  execute function public.homeatlas_record_door_conversation_activity();

-- This function is trigger-only. It inherits the narrow privileges of the
-- server-side writer and cannot be called as a browser-facing RPC.
revoke all on function public.homeatlas_record_door_conversation_activity()
  from public, anon, authenticated, service_role;

comment on function public.homeatlas_record_door_conversation_activity() is
  'Trigger-only, idempotent talk metric derived from conversational Door Memory outcomes';

commit;
