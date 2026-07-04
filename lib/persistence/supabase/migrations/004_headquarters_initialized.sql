-- Migration 004: Canonical headquarters initialization flag
-- Run in Supabase SQL Editor after 003_headquarters_profile.sql.

alter table headquarters_profile
  add column if not exists headquarters_initialized boolean not null default false;

update headquarters_profile
set headquarters_initialized = true
where onboarding_complete = true;

create index if not exists headquarters_profile_initialized_idx
  on headquarters_profile (headquarters_initialized)
  where headquarters_initialized = true;
