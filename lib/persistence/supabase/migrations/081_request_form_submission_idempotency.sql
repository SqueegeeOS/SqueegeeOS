-- Migration 081: make one public request-form submission safe to retry.
-- Legacy lead rows remain untouched. New browser submissions carry a UUID,
-- and the partial unique index is the final concurrency guarantee.

begin;

alter table public.lead_intakes
  add column if not exists client_submission_id uuid;

alter table public.lead_intakes
  drop constraint if exists lead_intakes_client_submission_source_check,
  add constraint lead_intakes_client_submission_source_check check (
    source = 'request_form' or client_submission_id is null
  );

create unique index if not exists lead_intakes_request_submission_uidx
  on public.lead_intakes(client_submission_id)
  where source = 'request_form' and client_submission_id is not null;

comment on column public.lead_intakes.client_submission_id is
  'Browser-generated UUID that makes one public request safe to retry without repeating automations';

commit;
