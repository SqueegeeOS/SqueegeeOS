-- Migration 055: one durable presentation per website or Meta inquiry.
-- The intake remains the authoritative source for customer identity while the
-- linked presentation becomes the resumable sales workspace.

begin;

alter table public.presentations
  add column if not exists lead_intake_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'presentations_lead_intake_id_fkey'
      and conrelid = 'public.presentations'::regclass
  ) then
    alter table public.presentations
      add constraint presentations_lead_intake_id_fkey
      foreign key (lead_intake_id)
      references public.lead_intakes(id)
      on delete restrict;
  end if;
end
$$;

-- A retry or a second browser tab must resolve the existing sales workspace,
-- never create a second presentation for the same customer inquiry.
create unique index if not exists presentations_lead_intake_uidx
  on public.presentations(lead_intake_id)
  where lead_intake_id is not null;

alter table public.presentations
  drop constraint if exists presentations_single_origin_check;
alter table public.presentations
  add constraint presentations_single_origin_check
  check (
    not (
      sales_rep_lead_id is not null
      and lead_intake_id is not null
    )
  );

comment on column public.presentations.lead_intake_id is
  'Authoritative website or Meta inquiry that created this resumable presentation.';

-- Presentations and lead intakes contain customer PII. Preserve the existing
-- service-role-only boundary as the lineage joins the records together.
revoke all privileges on table public.presentations
  from public, anon, authenticated;
revoke all privileges on table public.lead_intakes
  from public, anon, authenticated;
grant select, insert, update, delete on table public.presentations
  to service_role;
grant select, insert, update, delete on table public.lead_intakes
  to service_role;

commit;
