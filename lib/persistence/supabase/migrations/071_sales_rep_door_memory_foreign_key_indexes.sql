-- Give both composite ownership foreign keys an exact covering index. The
-- activity index remains unique, so one door knock can still have one outcome.

begin;

drop index if exists public.sales_rep_door_visits_activity_uidx;
create unique index sales_rep_door_visits_activity_uidx
  on public.sales_rep_door_visits(door_activity_id, rep_id);

drop index if exists public.sales_rep_door_visits_lead_idx;
create index sales_rep_door_visits_lead_idx
  on public.sales_rep_door_visits(lead_id, rep_id, occurred_at desc)
  where lead_id is not null;

commit;
