-- Migration 002: Closed Jobs / Sales Tracker
-- Run in Supabase SQL Editor after schema.sql (or standalone if other tables exist).
-- Safe to re-run: uses IF NOT EXISTS.

create table if not exists closed_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  property_address text not null,
  sale_amount numeric(12, 2) not null check (sale_amount >= 0),
  sale_type text not null check (sale_type in ('one_time', 'recurring_membership')),
  recurring_frequency text check (
    recurring_frequency in ('monthly', 'quarterly', 'bi_annual', 'annual')
  ),
  service_category text not null,
  closed_date date not null,
  notes text not null default '',
  created_by text,
  status text not null default 'closed',
  created_at timestamptz not null default now()
);

create index if not exists closed_jobs_closed_date_idx
  on closed_jobs (closed_date desc);

create index if not exists closed_jobs_created_at_idx
  on closed_jobs (created_at desc);

alter table closed_jobs enable row level security;

drop policy if exists "closed_jobs_anon_all" on closed_jobs;
create policy "closed_jobs_anon_all" on closed_jobs
  for all using (true) with check (true);
