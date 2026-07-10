-- Migration 030: Supabase security hardening (Advisor pass)
-- Prerequisite: SUPABASE_SERVICE_ROLE_KEY set on the server (Vercel).
-- Server routes use the service role (bypasses RLS). The browser anon key keeps
-- read/write on customer persistence tables only.
-- Safe to re-run: uses IF EXISTS / OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. set_updated_at — secure search_path (Advisor: function search_path mutable)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Referral tables — enable RLS (Advisor: RLS disabled in public)
-- ---------------------------------------------------------------------------
alter table if exists referral_codes enable row level security;
alter table if exists referral_visits enable row level security;
alter table if exists referrals enable row level security;

-- No anon policies: referral writes are server-only via service role.

-- ---------------------------------------------------------------------------
-- 3. Helper — drop legacy permissive anon policies
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like '%\_anon\_all' escape '\'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Customer persistence — anon read + write (browser adapter + signing flow)
-- ---------------------------------------------------------------------------
drop policy if exists "homeowners_anon_read" on public.homeowners;
drop policy if exists "homeowners_anon_insert" on public.homeowners;
drop policy if exists "homeowners_anon_update" on public.homeowners;
create policy "homeowners_anon_read"
  on public.homeowners for select to anon, authenticated
  using (true);

create policy "homeowners_anon_insert"
  on public.homeowners for insert to anon, authenticated
  with check (true);

create policy "homeowners_anon_update"
  on public.homeowners for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "properties_anon_read" on public.properties;
drop policy if exists "properties_anon_insert" on public.properties;
drop policy if exists "properties_anon_update" on public.properties;
create policy "properties_anon_read"
  on public.properties for select to anon, authenticated
  using (true);

create policy "properties_anon_insert"
  on public.properties for insert to anon, authenticated
  with check (true);

create policy "properties_anon_update"
  on public.properties for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "home_care_plans_anon_read" on public.home_care_plans;
drop policy if exists "home_care_plans_anon_insert" on public.home_care_plans;
drop policy if exists "home_care_plans_anon_update" on public.home_care_plans;
create policy "home_care_plans_anon_read"
  on public.home_care_plans for select to anon, authenticated
  using (true);

create policy "home_care_plans_anon_insert"
  on public.home_care_plans for insert to anon, authenticated
  with check (true);

create policy "home_care_plans_anon_update"
  on public.home_care_plans for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "memberships_anon_read" on public.memberships;
drop policy if exists "memberships_anon_insert" on public.memberships;
drop policy if exists "memberships_anon_update" on public.memberships;
create policy "memberships_anon_read"
  on public.memberships for select to anon, authenticated
  using (true);

create policy "memberships_anon_insert"
  on public.memberships for insert to anon, authenticated
  with check (true);

create policy "memberships_anon_update"
  on public.memberships for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "signed_agreements_anon_read" on public.signed_agreements;
drop policy if exists "signed_agreements_anon_insert" on public.signed_agreements;
drop policy if exists "signed_agreements_anon_update" on public.signed_agreements;
create policy "signed_agreements_anon_read"
  on public.signed_agreements for select to anon, authenticated
  using (true);

create policy "signed_agreements_anon_insert"
  on public.signed_agreements for insert to anon, authenticated
  with check (true);

create policy "signed_agreements_anon_update"
  on public.signed_agreements for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "property_assets_anon_read" on public.property_assets;
drop policy if exists "property_assets_anon_insert" on public.property_assets;
drop policy if exists "property_assets_anon_update" on public.property_assets;
create policy "property_assets_anon_read"
  on public.property_assets for select to anon, authenticated
  using (true);

create policy "property_assets_anon_insert"
  on public.property_assets for insert to anon, authenticated
  with check (true);

create policy "property_assets_anon_update"
  on public.property_assets for update to anon, authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 5. Signed-agreement storage — service role only (private bucket)
-- ---------------------------------------------------------------------------
drop policy if exists "signed_agreements_service_role_all" on storage.objects;
create policy "signed_agreements_service_role_all"
  on storage.objects for all to service_role
  using (bucket_id = 'signed-agreements')
  with check (bucket_id = 'signed-agreements');

comment on function public.set_updated_at() is
  'Trigger helper with fixed search_path (Supabase Advisor hardening).';
