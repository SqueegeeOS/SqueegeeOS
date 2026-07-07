-- Public bucket for signed agreement PDFs (email-safe HTTPS links)
-- Run in Supabase SQL Editor after 013_membership_onboarding.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signed-agreements',
  'signed-agreements',
  true,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Allow anon uploads from the app (service uses anon key today)
drop policy if exists "signed_agreements_public_read" on storage.objects;
create policy "signed_agreements_public_read"
  on storage.objects for select
  using (bucket_id = 'signed-agreements');

drop policy if exists "signed_agreements_anon_insert" on storage.objects;
create policy "signed_agreements_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'signed-agreements');

drop policy if exists "signed_agreements_anon_update" on storage.objects;
create policy "signed_agreements_anon_update"
  on storage.objects for update
  using (bucket_id = 'signed-agreements');
