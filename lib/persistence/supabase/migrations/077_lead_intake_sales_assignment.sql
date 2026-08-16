-- Migration 077: one durable operational assignment for each website or Meta inquiry.
-- The intake remains the customer/source truth; sales_rep_leads owns the
-- accountable representative, next action, and field follow-up queue.

begin;

alter table public.sales_rep_leads
  add column if not exists lead_intake_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_rep_leads_lead_intake_id_fkey'
      and conrelid = 'public.sales_rep_leads'::regclass
  ) then
    alter table public.sales_rep_leads
      add constraint sales_rep_leads_lead_intake_id_fkey
      foreign key (lead_intake_id)
      references public.lead_intakes(id)
      on delete restrict;
  end if;
end
$$;

alter table public.sales_rep_leads
  drop constraint if exists sales_rep_leads_source_check;
alter table public.sales_rep_leads
  add constraint sales_rep_leads_source_check
  check (source in (
    'door_to_door', 'referral', 'event', 'manual',
    'request_form', 'facebook_lead_ad'
  ));

alter table public.sales_rep_leads
  drop constraint if exists sales_rep_leads_intake_assignment_check;
alter table public.sales_rep_leads
  add constraint sales_rep_leads_intake_assignment_check
  check (
    lead_intake_id is null
    or (
      source in ('request_form', 'facebook_lead_ad')
      and next_follow_up_at is not null
    )
  );

-- One inquiry has one accountable sales owner. This partial unique index also
-- indexes the new foreign key without affecting field-created leads.
create unique index if not exists sales_rep_leads_lead_intake_uidx
  on public.sales_rep_leads(lead_intake_id)
  where lead_intake_id is not null;

comment on column public.sales_rep_leads.lead_intake_id is
  'Authoritative website or Meta inquiry represented by this private rep assignment.';
comment on index public.sales_rep_leads_lead_intake_uidx is
  'Guarantees one accountable sales assignment per customer inquiry.';

-- Count both doorstep-originated and assigned inquiry-originated plans in the
-- existing launch cockpit without inflating its manual pitch activity metric.
create or replace function public.homeatlas_sales_rep_launch_evidence()
returns table (
  rep_id uuid,
  door_count bigint,
  lead_count bigint,
  presentation_count bigint,
  verified_close_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rep.id as rep_id,
    (
      select count(*)
      from public.sales_rep_door_visits door_visit
      where door_visit.rep_id = rep.id
    ) as door_count,
    (
      select count(*)
      from public.sales_rep_leads lead
      where lead.rep_id = rep.id
    ) as lead_count,
    (
      select count(*)
      from public.presentations presentation
      where presentation.sales_rep_id = rep.id
        and (
          presentation.sales_rep_lead_id is not null
          or exists (
            select 1
            from public.sales_rep_leads assigned_lead
            where assigned_lead.rep_id = rep.id
              and assigned_lead.lead_intake_id = presentation.lead_intake_id
          )
        )
    ) as presentation_count,
    (
      select count(*)
      from public.sales_rep_attributions attribution
      where attribution.rep_id = rep.id
        and attribution.signed_agreement_id is not null
        and attribution.qualification_status <> 'cancelled'
    ) as verified_close_count
  from public.sales_reps rep
  where rep.status = 'active';
$$;

revoke all on function public.homeatlas_sales_rep_launch_evidence()
  from public, anon, authenticated;
grant execute on function public.homeatlas_sales_rep_launch_evidence()
  to service_role;

-- Preserve the existing service-role-only privacy boundary for customer PII.
alter table public.sales_rep_leads enable row level security;
revoke all privileges on table public.sales_rep_leads
  from public, anon, authenticated;
grant select, insert, update, delete on table public.sales_rep_leads
  to service_role;

commit;
