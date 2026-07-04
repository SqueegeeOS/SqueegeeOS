-- Lead intakes from /request form
create table if not exists lead_intakes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  service_address text not null,
  services_interested text[] not null default '{}',
  preferred_contact_method text not null default 'Phone',
  notes text not null default '',
  membership_tier text check (membership_tier in ('quarterly', 'biannual')),
  square_footage integer,
  estimated_visit_price numeric(10, 2),
  preferred_start_window text,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled')),
  source text not null default 'request_form',
  submitted_at timestamptz not null default now()
);

create index if not exists lead_intakes_submitted_at_idx on lead_intakes(submitted_at desc);
create index if not exists lead_intakes_status_idx on lead_intakes(status);

alter table lead_intakes enable row level security;
create policy "lead_intakes_anon_all" on lead_intakes for all using (true) with check (true);
