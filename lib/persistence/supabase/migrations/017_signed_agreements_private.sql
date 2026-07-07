-- Private signed-agreement storage (Customer #1 — wargame 001 Phase 2)
-- Run in Supabase SQL Editor after 016_portal_access_token.sql
-- Requires SUPABASE_SERVICE_ROLE_KEY on the server for uploads and signed URLs.

update storage.buckets
set public = false
where id = 'signed-agreements';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signed-agreements',
  'signed-agreements',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove world-readable and anon-writable policies from migration 014.
drop policy if exists "signed_agreements_public_read" on storage.objects;
drop policy if exists "signed_agreements_anon_insert" on storage.objects;
drop policy if exists "signed_agreements_anon_update" on storage.objects;
