-- Migration 076: one read-only, service-role-only aggregate for the field
-- revenue-loop launch cockpit. This avoids issuing four count queries for
-- every active rep while keeping customer and lead rows private.

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
        and presentation.sales_rep_lead_id is not null
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

comment on function public.homeatlas_sales_rep_launch_evidence() is
  'Read-only first-loop evidence counts for private HQ sales activation; service role only';
