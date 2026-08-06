-- Durable presentation editor snapshot.
-- Relational columns remain the reporting/query source; draft_payload keeps a
-- complete, versioned copy of every editable field for dependable reopening.

alter table public.presentations
  add column if not exists draft_payload jsonb not null default '{}'::jsonb;

comment on column public.presentations.draft_payload is
  'Versioned snapshot of every presentation editor field used to restore drafts without data loss.';
