-- Dynamic Property Assessments — flexible JSONB scores per visit
-- visit_id has no FK in v1 (optional opaque reference)

do $$ begin
  create type assessment_type as enum (
    'window_service',
    'care_package',
    'custom'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists property_assessments (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references properties(id)
                          on delete cascade,
  visit_id              uuid,
  assessment_type       assessment_type not null default 'window_service',
  technician_name       text not null,
  visit_date            date not null default current_date,
  scores                jsonb not null default '{}'::jsonb,
  assessed_areas        text[] not null default '{}',
  na_areas              text[] not null default '{}',
  overall_score         numeric(5,2),
  internal_note         text,
  customer_note         text,
  customer_note_visible boolean not null default false,
  proposal_summary      text,
  recommended_services  jsonb,
  proposal_sent         boolean not null default false,
  proposal_sent_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column property_assessments.visit_id is
  'Optional opaque visit reference. No FK in v1.';

create index if not exists idx_assessments_property_id
  on property_assessments(property_id);

create index if not exists idx_assessments_visit_date
  on property_assessments(visit_date desc);

create index if not exists idx_assessments_type
  on property_assessments(assessment_type);

drop trigger if exists property_assessments_updated_at
  on property_assessments;
create trigger property_assessments_updated_at
  before update on property_assessments
  for each row execute function set_updated_at();

alter table property_assessments enable row level security;

drop policy if exists "assessments_anon_all" on property_assessments;
create policy "assessments_anon_all" on property_assessments
  for all using (true) with check (true);
