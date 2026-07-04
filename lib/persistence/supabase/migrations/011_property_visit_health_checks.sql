-- Property Visit Health Checks — Atlas Home Memory v1
-- Every visit leaves memory behind.
--
-- visit_id is optional and has no FK in v1 — link to appointments later
-- when member_appointments (or visits) exists in production.

create table if not exists property_visit_health_checks (
  id                        uuid primary key default gen_random_uuid(),
  property_id               uuid not null references properties(id)
                            on delete cascade,
  visit_id                  uuid,
  technician_name           text not null,
  visit_date                date not null default current_date,
  window_health_score       smallint check (window_health_score between 1 and 5),
  screen_health_score       smallint check (screen_health_score between 1 and 5),
  track_sill_health_score   smallint check (track_sill_health_score between 1 and 5),
  frame_health_score        smallint check (frame_health_score between 1 and 5),
  hard_water_risk_score     smallint check (hard_water_risk_score between 1 and 5),
  debris_buildup_score      smallint check (debris_buildup_score between 1 and 5),
  overall_score             numeric(5,2),
  internal_note             text,
  customer_note             text,
  customer_note_visible     boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on column property_visit_health_checks.visit_id is
  'Optional opaque visit reference. No FK in v1; add when appointments table ships.';

create index if not exists idx_health_checks_property_id
  on property_visit_health_checks(property_id);

create index if not exists idx_health_checks_visit_date
  on property_visit_health_checks(visit_date desc);

drop trigger if exists property_visit_health_checks_updated_at
  on property_visit_health_checks;
create trigger property_visit_health_checks_updated_at
  before update on property_visit_health_checks
  for each row execute function set_updated_at();

alter table property_visit_health_checks enable row level security;

-- Permissive until Supabase Auth ships (matches member_intelligence pattern).
drop policy if exists "health_checks_anon_all" on property_visit_health_checks;
create policy "health_checks_anon_all" on property_visit_health_checks
  for all using (true) with check (true);
