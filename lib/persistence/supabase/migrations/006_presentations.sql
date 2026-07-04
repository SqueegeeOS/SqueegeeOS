-- Presentation Engine — sales deck + live signature close
-- Run after schema.sql

create table if not exists presentations (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  client_name text not null,
  client_address text not null default '',
  client_email text,
  home_sqft integer not null default 2500,
  tier text not null default 'premium'
    check (tier in ('essential', 'premium', 'elite')),
  monthly_rate numeric(10,2) not null default 0,
  annual_rate numeric(10,2) not null default 0,
  retail_value numeric(10,2) not null default 0,
  custom_notes text,
  slide_overrides jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'presented', 'signed')),
  signed_at timestamptz,
  agreement_id uuid references signed_agreements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentations_created_by_idx on presentations(created_by);
create index if not exists presentations_status_idx on presentations(status);

drop trigger if exists presentations_updated_at on presentations;
create trigger presentations_updated_at before update on presentations
  for each row execute function set_updated_at();

alter table presentations enable row level security;

drop policy if exists "presentations_anon_all" on presentations;
create policy "presentations_anon_all" on presentations for all using (true) with check (true);
