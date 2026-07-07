-- Founding member cohort — record at creation; cannot be backfilled honestly later.
-- Run after 014_signed_agreements_storage.sql

alter table memberships
  add column if not exists founding_member boolean not null default false,
  add column if not exists founding_member_since timestamptz;

create index if not exists memberships_founding_member_idx
  on memberships(founding_member)
  where founding_member = true;

comment on column memberships.founding_member is
  'True for memberships created during the early launch founding cohort';
comment on column memberships.founding_member_since is
  'When founding status was granted (typically agreement sign time)';
comment on column memberships.started_at is
  'Member since — membership start date for display (e.g. Member since 2026)';
