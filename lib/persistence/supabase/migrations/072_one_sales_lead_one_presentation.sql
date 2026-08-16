-- Migration 072: make the field-sales promise of one resumable presentation
-- per homeowner lead a database invariant. The application already resumes an
-- existing presentation; this closes the final two-tab race at the write layer.

begin;

do $$
begin
  if exists (
    select 1
    from public.presentations
    where sales_rep_lead_id is not null
    group by sales_rep_lead_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Duplicate sales lead presentations must be resolved before migration 072.';
  end if;
end
$$;

-- A sales lead ID is globally unique and already carries a composite foreign
-- key back to its owning representative. One partial unique index therefore
-- proves both idempotency and exact lead lineage without affecting ordinary HQ
-- presentations that have no field lead.
create unique index if not exists presentations_sales_rep_lead_uidx
  on public.presentations(sales_rep_lead_id)
  where sales_rep_lead_id is not null;

comment on index public.presentations_sales_rep_lead_uidx is
  'Guarantees one durable resumable presentation per private field-sales lead';

commit;
