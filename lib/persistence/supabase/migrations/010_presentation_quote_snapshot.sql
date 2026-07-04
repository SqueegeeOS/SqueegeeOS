-- Presentation custom quote snapshot from Care Plan Builder
alter table presentations add column if not exists quote_snapshot jsonb;

comment on column presentations.quote_snapshot is
  'Frozen window care + exterior add-on quote from Care Plan Builder';
