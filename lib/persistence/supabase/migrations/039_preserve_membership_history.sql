-- Preserve cancelled/inactive membership history without allowing two current
-- memberships to control the same property at once.
-- Run after 038_close_customer_anon_access.sql.

alter table public.memberships
  drop constraint if exists memberships_property_id_key;

drop index if exists public.memberships_property_id_key;

create unique index if not exists memberships_one_current_per_property_idx
  on public.memberships(property_id)
  where status in ('pending_checkout', 'pending_payment', 'active', 'paused');

create index if not exists memberships_property_history_idx
  on public.memberships(property_id, created_at desc);

comment on index public.memberships_one_current_per_property_idx is
  'Allows membership history while enforcing at most one current membership per property';
