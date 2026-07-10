-- INCIDENT HOTFIX (not a numbered migration)
-- Use only if production cannot read portal/HQ data after migration 030
-- and SUPABASE_SERVICE_ROLE_KEY is not yet on Vercel.
-- Preferred fix: set SUPABASE_SERVICE_ROLE_KEY on Vercel and redeploy.
-- Safe to re-run: drops and recreates read-only anon policies.

-- Portal + member intelligence (read only)
drop policy if exists member_appointments_anon_read on public.member_appointments;
create policy member_appointments_anon_read
  on public.member_appointments for select to anon, authenticated using (true);

drop policy if exists member_profiles_anon_read on public.member_profiles;
create policy member_profiles_anon_read
  on public.member_profiles for select to anon, authenticated using (true);

drop policy if exists member_savings_anon_read on public.member_savings_transactions;
create policy member_savings_anon_read
  on public.member_savings_transactions for select to anon, authenticated using (true);

drop policy if exists member_addon_transactions_anon_read on public.member_addon_transactions;
create policy member_addon_transactions_anon_read
  on public.member_addon_transactions for select to anon, authenticated using (true);

drop policy if exists member_savings_ledger_entries_anon_read on public.member_savings_ledger_entries;
create policy member_savings_ledger_entries_anon_read
  on public.member_savings_ledger_entries for select to anon, authenticated using (true);

drop policy if exists service_observations_anon_read on public.service_observations;
create policy service_observations_anon_read
  on public.service_observations for select to anon, authenticated using (true);

-- HQ command center (read only)
drop policy if exists closed_jobs_anon_read on public.closed_jobs;
create policy closed_jobs_anon_read
  on public.closed_jobs for select to anon, authenticated using (true);

drop policy if exists presentations_anon_read on public.presentations;
create policy presentations_anon_read
  on public.presentations for select to anon, authenticated using (true);

drop policy if exists lead_intakes_anon_read on public.lead_intakes;
create policy lead_intakes_anon_read
  on public.lead_intakes for select to anon, authenticated using (true);

drop policy if exists headquarters_profile_anon_read on public.headquarters_profile;
create policy headquarters_profile_anon_read
  on public.headquarters_profile for select to anon, authenticated using (true);

drop policy if exists website_membership_sales_anon_read on public.website_membership_sales;
create policy website_membership_sales_anon_read
  on public.website_membership_sales for select to anon, authenticated using (true);

drop policy if exists membership_billing_charges_anon_read on public.membership_billing_charges;
create policy membership_billing_charges_anon_read
  on public.membership_billing_charges for select to anon, authenticated using (true);

drop policy if exists member_referral_rewards_anon_read on public.member_referral_rewards;
create policy member_referral_rewards_anon_read
  on public.member_referral_rewards for select to anon, authenticated using (true);
