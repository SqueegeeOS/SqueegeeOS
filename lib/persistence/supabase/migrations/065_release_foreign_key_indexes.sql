begin;

-- Keep delete/update checks and owner-facing joins fast as the field-service
-- ledgers begin accumulating real production history.
create index if not exists customer_aftercare_resolutions_homeowner_idx
  on public.customer_aftercare_resolutions (homeowner_id);

create index if not exists customer_aftercare_resolutions_property_idx
  on public.customer_aftercare_resolutions (property_id);

create index if not exists customer_service_cases_homeowner_idx
  on public.customer_service_cases (homeowner_id);

create index if not exists customer_service_cases_property_idx
  on public.customer_service_cases (property_id);

create index if not exists field_independence_reviews_property_idx
  on public.field_independence_reviews (property_id);

create index if not exists technician_visit_events_property_idx
  on public.technician_visit_events (property_id);

commit;
