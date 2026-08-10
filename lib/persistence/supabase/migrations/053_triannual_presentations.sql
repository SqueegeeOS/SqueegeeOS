-- Optional three-visits-per-year presentation cadence.
-- Quarterly and Bi-Annual remain the primary public plans.

alter table public.presentations
  drop constraint if exists presentations_tier_check;
alter table public.presentations
  add constraint presentations_tier_check
  check (tier in ('biannual', 'triannual', 'quarterly'));

alter table public.memberships
  drop constraint if exists memberships_sales_tier_check;
alter table public.memberships
  add constraint memberships_sales_tier_check
  check (sales_tier is null or sales_tier in ('biannual', 'triannual', 'quarterly'));

alter table public.website_membership_sales
  drop constraint if exists website_membership_sales_sales_tier_check;
alter table public.website_membership_sales
  add constraint website_membership_sales_sales_tier_check
  check (sales_tier in ('biannual', 'triannual', 'quarterly'));

alter table public.member_addon_transactions
  drop constraint if exists member_addon_transactions_sales_tier_check;
alter table public.member_addon_transactions
  add constraint member_addon_transactions_sales_tier_check
  check (sales_tier is null or sales_tier in ('biannual', 'triannual', 'quarterly'));
