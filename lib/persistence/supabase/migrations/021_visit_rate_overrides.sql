-- Per-tier manual visit overrides (bi-annual vs quarterly scoped independently)
alter table presentations
  add column if not exists visit_rate_overrides jsonb not null default '{}'::jsonb,
  add column if not exists override_tier text;

comment on column presentations.visit_rate_overrides is
  'Manual per-visit overrides by tier, e.g. {"biannual": 300, "quarterly": 249}';
comment on column presentations.override_tier is
  'Legacy scope for monthly_rate when visit_rate_overrides is empty';
