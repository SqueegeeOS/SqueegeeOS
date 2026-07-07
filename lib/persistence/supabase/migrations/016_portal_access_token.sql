-- Private member portal access — unguessable token per membership (magic link).
-- Run after 015_founding_member.sql

alter table memberships
  add column if not exists portal_access_token text;

create unique index if not exists memberships_portal_access_token_uidx
  on memberships(portal_access_token)
  where portal_access_token is not null;

comment on column memberships.portal_access_token is
  'Unguessable portal magic-link token — customer emails use /portal/{token}, not slugs';
