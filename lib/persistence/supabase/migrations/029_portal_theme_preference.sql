-- Saved HomeAtlas portal atmosphere per membership (Day / Night / Lux).
-- Run after 028_member_savings_ledger_and_referral_rewards.sql

alter table memberships
  add column if not exists portal_theme text
  check (portal_theme is null or portal_theme in ('day', 'night', 'lux'));

comment on column memberships.portal_theme is
  'Member-saved portal atmosphere — day, night, or lux; loaded on /portal/[token] reopen';
