-- SqueegeeKing tier ladder — presentations table tier values
-- Run after 006_presentations.sql

-- Normalize legacy tier values
update presentations
set tier = case
  when tier in ('essential', 'one-time', 'bi-annual', 'bi_annual') then 'biannual'
  else 'quarterly'
end
where tier not in ('biannual', 'quarterly');

-- Replace check constraint if present (Postgres)
alter table presentations drop constraint if exists presentations_tier_check;

alter table presentations
  add constraint presentations_tier_check
  check (tier in ('biannual', 'quarterly'));

alter table presentations alter column tier set default 'quarterly';

comment on column presentations.monthly_rate is
  'Per-visit rate for SqueegeeKing membership (legacy column name)';
