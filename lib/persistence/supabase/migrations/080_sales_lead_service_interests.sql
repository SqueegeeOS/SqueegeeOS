-- Migration 080: preserve the services discussed at the doorstep on the same
-- private sales lead that owns follow-up and presentation lineage. These are
-- interest signals only; they never constitute quoted or signed service scope.

begin;

alter table public.sales_rep_leads
  add column if not exists service_interests text[] not null
    default array['exterior_windows']::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_rep_leads'::regclass
      and conname = 'sales_rep_leads_service_interests_check'
  ) then
    alter table public.sales_rep_leads
      add constraint sales_rep_leads_service_interests_check
      check (
        cardinality(service_interests) between 1 and 5
        and service_interests @> array['exterior_windows']::text[]
        and service_interests <@ array[
          'exterior_windows',
          'interior_windows',
          'screens',
          'cobweb_removal',
          'other'
        ]::text[]
      );
  end if;
end
$$;

comment on column public.sales_rep_leads.service_interests is
  'Non-contractual services discussed with the homeowner; final scope and pricing live in the signed presentation care plan';

commit;
