-- Migration 084: keep the exact property services discussed on public and
-- field leads through owner assignment and presentation creation. These remain
-- non-contractual interest signals; signed scope and pricing live elsewhere.

begin;

alter table public.sales_rep_leads
  drop constraint if exists sales_rep_leads_service_interests_check;

alter table public.sales_rep_leads
  add constraint sales_rep_leads_service_interests_check
  check (
    cardinality(service_interests) between 1 and 9
    and service_interests @> array['exterior_windows']::text[]
    and service_interests <@ array[
      'exterior_windows',
      'interior_windows',
      'screens',
      'cobweb_removal',
      'solar_panels',
      'pressure_washing',
      'gutter_cleaning',
      'home_care_membership',
      'other'
    ]::text[]
  );

comment on column public.sales_rep_leads.service_interests is
  'Non-contractual services discussed at any acquisition source; final scope and pricing live in the signed presentation care plan';

commit;
