-- Allow archiving handled requests (founder inbox)
alter table lead_intakes drop constraint if exists lead_intakes_status_check;
alter table lead_intakes
  add constraint lead_intakes_status_check
  check (status in ('new', 'contacted', 'scheduled', 'archived'));
