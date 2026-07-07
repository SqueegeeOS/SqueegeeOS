-- Obligation ledger — promises owed per active membership (wargame 013)
-- Run after 017_signed_agreements_private.sql

create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  homeowner_id uuid not null references homeowners(id) on delete cascade,
  sequence smallint not null check (sequence >= 1),
  membership_year smallint not null default 1 check (membership_year >= 1),
  target_window_start date not null,
  target_window_end date not null,
  status text not null default 'promised' check (
    status in (
      'promised',
      'scheduled',
      'completed',
      'missed',
      'credited',
      'waived',
      'void'
    )
  ),
  memory_status text not null default 'none' check (
    memory_status in ('none', 'present', 'missing_flagged')
  ),
  disposition text check (
    disposition is null or disposition in ('rolled', 'credited', 'waived')
  ),
  disposition_reason text,
  billing_service_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, membership_year, sequence),
  check (target_window_end >= target_window_start)
);

create index if not exists obligations_membership_id_idx
  on obligations(membership_id);

create index if not exists obligations_property_id_idx
  on obligations(property_id);

create index if not exists obligations_status_idx
  on obligations(status);

create table if not exists obligation_events (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references obligations(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text,
  reason text,
  source text not null check (source in ('jobber_sync', 'manual', 'system')),
  occurred_at timestamptz not null default now()
);

create index if not exists obligation_events_obligation_id_idx
  on obligation_events(obligation_id);

create trigger obligations_updated_at before update on obligations
  for each row execute function set_updated_at();

alter table obligations enable row level security;
alter table obligation_events enable row level security;

drop policy if exists "obligations_anon_all" on obligations;
create policy "obligations_anon_all"
  on obligations for all using (true) with check (true);

drop policy if exists "obligation_events_anon_all" on obligation_events;
create policy "obligation_events_anon_all"
  on obligation_events for all using (true) with check (true);

comment on table obligations is
  'Visit promises owed per membership — generated when membership becomes active';
