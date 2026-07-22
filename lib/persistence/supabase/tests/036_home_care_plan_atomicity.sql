-- Disposable-database rehearsal for migration 036.
-- Every fixture is transaction-scoped; signed agreement history is untouched.
begin;

create or replace function pg_temp.fail_pr1b_plan_write()
returns trigger
language plpgsql
as $$
begin
  raise exception 'injected PR1b plan failure';
end;
$$;

create trigger pr1b_injected_plan_failure
before insert or update on public.home_care_plans
for each row execute function pg_temp.fail_pr1b_plan_write();

do $$
begin
  begin
    perform public.save_hq_home_care_plan(
      'pr1b-atomic-homeowner',
      'PR1B Atomic Homeowner',
      'PR1B',
      null,
      null,
      'pr1b-atomic-property',
      'PR1B Atomic Property',
      '1 Atomic Way',
      'Chico',
      'California',
      '95928',
      'Residence',
      null,
      85::smallint,
      2020::smallint,
      null,
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'Injected failure did not fire';
  exception
    when others then
      if sqlerrm <> 'injected PR1b plan failure' then
        raise;
      end if;
  end;

  if exists (
    select 1 from public.homeowners where slug = 'pr1b-atomic-homeowner'
  ) or exists (
    select 1 from public.properties where slug = 'pr1b-atomic-property'
  ) then
    raise exception 'Homeowner/property state survived an atomic plan failure';
  end if;
end $$;

drop trigger pr1b_injected_plan_failure on public.home_care_plans;

do $$
declare
  first_plan public.home_care_plans;
  retry_plan public.home_care_plans;
begin
  first_plan := public.save_hq_home_care_plan(
    'pr1b-retry-homeowner',
    'PR1B Retry Homeowner',
    'PR1B',
    null,
    null,
    'pr1b-retry-property',
    'PR1B Retry Property',
    '2 Retry Way',
    'Chico',
    'California',
    '95928',
    'Residence',
    null,
    90::smallint,
    2021::smallint,
    null,
    '{"version": 1}'::jsonb,
    '{}'::jsonb
  );
  retry_plan := public.save_hq_home_care_plan(
    'pr1b-retry-homeowner',
    'PR1B Retry Homeowner',
    'PR1B',
    null,
    null,
    'pr1b-retry-property',
    'PR1B Retry Property',
    '2 Retry Way',
    'Chico',
    'California',
    '95928',
    'Residence',
    null,
    90::smallint,
    2021::smallint,
    null,
    '{"version": 1}'::jsonb,
    '{}'::jsonb
  );

  if first_plan.id <> retry_plan.id
    or first_plan.homeowner_id <> retry_plan.homeowner_id
    or first_plan.property_id <> retry_plan.property_id
  then
    raise exception 'Home Care Plan retry changed source IDs';
  end if;

  if (select count(*) from public.homeowners where slug = 'pr1b-retry-homeowner') <> 1
    or (select count(*) from public.properties where slug = 'pr1b-retry-property') <> 1
    or (select count(*) from public.home_care_plans where homeowner_slug = 'pr1b-retry-homeowner' and property_slug = 'pr1b-retry-property') <> 1
  then
    raise exception 'Home Care Plan retry created duplicate records';
  end if;

  if exists (
    select 1 from public.properties
    where slug = 'pr1b-retry-property' and last_visit is not null
  ) then
    raise exception 'Home Care Plan authoring invented provider visit history';
  end if;
end $$;

rollback;
