-- Migration 003: Shared Headquarters / Legacy profile (singleton row)
-- Safe to re-run: uses IF NOT EXISTS.
-- Includes headquarters_initialized (canonical one-time setup flag).

create table if not exists headquarters_profile (
  id text primary key default 'squeegeeking',
  business_started_date date,
  google_reviews_baseline integer not null default 0 check (google_reviews_baseline >= 0),
  homes_served_baseline integer not null default 0 check (homes_served_baseline >= 0),
  lifetime_revenue_baseline numeric(14, 2) not null default 0 check (lifetime_revenue_baseline >= 0),
  largest_month text not null default '',
  largest_job text not null default '',
  current_recurring_customers integer not null default 0 check (current_recurring_customers >= 0),
  about_noah text not null default '',
  about_dasan text not null default '',
  company_stand_for text not null default '',
  onboarding_complete boolean not null default false,
  headquarters_initialized boolean not null default false,
  founders jsonb not null default '["Noah Thomas", "Dasan Gramps"]'::jsonb,
  legacy_milestones jsonb not null default '[]'::jsonb,
  portrait_noah text,
  portrait_dasan text,
  lifetime_arr numeric(14, 2) not null default 0 check (lifetime_arr >= 0),
  closed_jobs_count integer not null default 0 check (closed_jobs_count >= 0),
  memberships_sold integer not null default 0 check (memberships_sold >= 0),
  active_members integer not null default 0 check (active_members >= 0),
  has_employee boolean not null default false,
  has_company_truck boolean not null default false,
  multi_city_expansion boolean not null default false,
  configured boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table headquarters_profile
  add column if not exists headquarters_initialized boolean not null default false;

create index if not exists headquarters_profile_updated_at_idx
  on headquarters_profile (updated_at desc);

create index if not exists headquarters_profile_initialized_idx
  on headquarters_profile (headquarters_initialized)
  where headquarters_initialized = true;

alter table headquarters_profile enable row level security;

drop policy if exists "headquarters_profile_anon_all" on headquarters_profile;
create policy "headquarters_profile_anon_all" on headquarters_profile
  for all using (true) with check (true);

insert into headquarters_profile (id)
values ('squeegeeking')
on conflict (id) do nothing;

update headquarters_profile
set headquarters_initialized = true
where onboarding_complete = true
  and headquarters_initialized = false;
