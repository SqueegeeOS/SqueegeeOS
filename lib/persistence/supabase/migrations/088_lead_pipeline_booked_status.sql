-- Complete the owner-operated lead pipeline without rewriting the existing
-- quoted/lost records. The application presents `scheduled` as Quoted and
-- `archived` as Lost; only the explicit Booked state is new.

alter table public.lead_intakes
  drop constraint if exists lead_intakes_status_check;

alter table public.lead_intakes
  add constraint lead_intakes_status_check
  check (status in ('new', 'contacted', 'scheduled', 'booked', 'archived'));
