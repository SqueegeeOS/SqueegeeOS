-- Migration 047: keep Jobber scheduling sync available when the connected app
-- cannot read Invoice objects, while preserving automatic-billing fail-closed.

-- Rows written before invoice visibility was recorded are not billing truth.
-- Hold them until a fresh Jobber sync records either NONE, an invoice, or the
-- explicit PERMISSION_HIDDEN sentinel.
update public.jobber_visit_projections
set job_will_auto_charge = true,
    visit_invoice_status = 'UNKNOWN'
where visit_invoice_status is null;

alter table public.jobber_visit_projections
  drop constraint if exists jobber_visit_projection_invoice_visibility_check,
  add constraint jobber_visit_projection_invoice_visibility_check check (
    job_will_auto_charge = true
    or (
      visit_invoice_id is null
      and visit_invoice_status = 'NONE'
    )
    or (
      visit_invoice_id is not null
      and nullif(trim(coalesce(visit_invoice_status, '')), '') is not null
    )
  );

comment on constraint jobber_visit_projection_invoice_visibility_check
  on public.jobber_visit_projections is
  'A projection can be considered for billing only when Jobber invoice visibility was available and reported no invoice. Hidden or unknown invoice state is held through job_will_auto_charge.';
