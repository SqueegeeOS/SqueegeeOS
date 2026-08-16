-- Tighten the live Door Memory table to the same least-privilege contract used
-- by a fresh migration run. Supabase's default table grants can otherwise leave
-- service_role with destructive privileges that this workflow never needs.

begin;

revoke all privileges on table public.sales_rep_door_visits
  from service_role;
grant select, insert on table public.sales_rep_door_visits
  to service_role;
grant update (lead_id) on table public.sales_rep_door_visits
  to service_role;

commit;
