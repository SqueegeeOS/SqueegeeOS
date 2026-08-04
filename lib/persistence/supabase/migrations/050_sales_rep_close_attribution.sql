-- Migration 050: stable salesperson lineage from a field presentation through
-- the signed membership. A legal signature is the authoritative close event;
-- manual pulse taps are deliberately not used for close or ARR totals.

begin;

alter table public.presentations
  add column if not exists sales_rep_id uuid
    references public.sales_reps(id) on delete restrict,
  add column if not exists sales_rep_lead_id uuid;

-- A lead carried by a presentation must belong to the same representative.
create unique index if not exists sales_rep_leads_id_rep_uidx
  on public.sales_rep_leads(id, rep_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'presentations_sales_rep_lead_owner_fkey'
      and conrelid = 'public.presentations'::regclass
  ) then
    alter table public.presentations
      add constraint presentations_sales_rep_lead_owner_fkey
      foreign key (sales_rep_lead_id, sales_rep_id)
      references public.sales_rep_leads(id, rep_id)
      on delete restrict;
  end if;
end
$$;

alter table public.presentations
  drop constraint if exists presentations_sales_rep_lead_requires_rep_check;
alter table public.presentations
  add constraint presentations_sales_rep_lead_requires_rep_check
  check (sales_rep_lead_id is null or sales_rep_id is not null);

create index if not exists presentations_sales_rep_created_idx
  on public.presentations(sales_rep_id, created_at desc)
  where sales_rep_id is not null;
create index if not exists presentations_sales_rep_lead_idx
  on public.presentations(sales_rep_lead_id)
  where sales_rep_lead_id is not null;
create unique index if not exists presentations_id_sales_rep_uidx
  on public.presentations(id, sales_rep_id);

alter table public.sales_rep_attributions
  add column if not exists presentation_id uuid
    references public.presentations(id) on delete restrict,
  add column if not exists signed_agreement_id uuid
    references public.signed_agreements(id) on delete restrict,
  add column if not exists attribution_source text,
  add column if not exists attributed_at timestamptz;

-- Rows created before the signature bridge must not be relabeled as verified
-- signature events. Their original creation time is the safest event time.
update public.sales_rep_attributions
set attribution_source = 'legacy_backfill'
where attribution_source is null;
update public.sales_rep_attributions
set attributed_at = created_at
where attributed_at is null;

alter table public.sales_rep_attributions
  alter column attribution_source set default 'agreement_signature',
  alter column attribution_source set not null,
  alter column attributed_at set default now(),
  alter column attributed_at set not null;

alter table public.sales_rep_attributions
  drop constraint if exists sales_rep_attributions_source_check;
alter table public.sales_rep_attributions
  add constraint sales_rep_attributions_source_check
  check (attribution_source in ('agreement_signature', 'legacy_backfill'));

create index if not exists sales_rep_attributions_rep_attributed_idx
  on public.sales_rep_attributions(rep_id, attributed_at desc);
create index if not exists sales_rep_attributions_presentation_idx
  on public.sales_rep_attributions(presentation_id)
  where presentation_id is not null;
create unique index if not exists sales_rep_attributions_agreement_uidx
  on public.sales_rep_attributions(signed_agreement_id)
  where signed_agreement_id is not null;

-- Client-generated UUIDs make quick-action retries idempotent when a weak
-- mobile connection loses the first HTTP response.
alter table public.sales_rep_activity_events
  add column if not exists client_event_id uuid;
create unique index if not exists sales_rep_activity_rep_client_event_uidx
  on public.sales_rep_activity_events(rep_id, client_event_id);

-- Preserve the old human-readable creator label, but turn David's existing
-- presentation lineage into a stable foreign key.
update public.presentations p
set sales_rep_id = r.id
from public.sales_reps r
where p.sales_rep_id is null
  and lower(btrim(coalesce(p.created_by, ''))) = 'david'
  and r.slug = 'david'
  and r.status = 'active';

-- Backfill any memberships already signed from a rep-linked presentation.
-- The amount comes only from memberships.annual_rate, never browser pricing.
do $$
begin
  if exists (
    select 1
    from public.presentations p
    join public.memberships m on (
      m.id = p.membership_id
      or (p.membership_id is null and m.presentation_id = p.id)
    )
    join public.signed_agreements sa on sa.id = coalesce(m.agreement_id, p.agreement_id)
      and sa.status = 'complete'
      and sa.membership_id = m.id
      and sa.presentation_id = p.id
    join public.sales_rep_attributions a on a.membership_id = m.id
    where p.sales_rep_id is not null
      and a.rep_id <> p.sales_rep_id
      and not exists (
        select 1
        from public.memberships other_m
        join public.signed_agreements other_sa
          on other_sa.id = coalesce(other_m.agreement_id, p.agreement_id)
          and other_sa.status = 'complete'
          and other_sa.membership_id = other_m.id
          and other_sa.presentation_id = p.id
        where p.membership_id is null
          and other_m.presentation_id = p.id
          and other_m.id <> m.id
      )
  ) then
    raise exception
      'Existing membership attribution conflicts with presentation salesperson';
  end if;
end
$$;

insert into public.sales_rep_attributions (
  rep_id,
  lead_id,
  membership_id,
  presentation_id,
  signed_agreement_id,
  attributed_arr_cents,
  qualification_status,
  membership_started_at,
  retention_qualifies_at,
  compensation_plan_snapshot,
  attribution_source,
  attributed_at
)
select
  p.sales_rep_id,
  p.sales_rep_lead_id,
  m.id,
  p.id,
  sa.id,
  least(100000000, greatest(0, round(coalesce(m.annual_rate, 0) * 100)))::integer,
  case
    when m.status = 'active' then 'active'
    when m.status in ('cancelled', 'archived') then 'cancelled'
    else 'pending'
  end,
  coalesce(m.started_at, sa.signed_at, m.created_at),
  case
    when r.compensation_plan = 'founding_david'
      then coalesce(m.started_at, sa.signed_at, m.created_at) + interval '12 months'
    else null
  end,
  r.compensation_plan,
  'legacy_backfill',
  sa.signed_at
from public.presentations p
join public.memberships m on (
  m.id = p.membership_id
  or (p.membership_id is null and m.presentation_id = p.id)
)
join public.signed_agreements sa on sa.id = coalesce(m.agreement_id, p.agreement_id)
  and sa.status = 'complete'
  and sa.membership_id = m.id
  and sa.presentation_id = p.id
join public.sales_reps r on r.id = p.sales_rep_id
where p.sales_rep_id is not null
  and m.id is not null
  and not exists (
    select 1
    from public.memberships other_m
    join public.signed_agreements other_sa
      on other_sa.id = coalesce(other_m.agreement_id, p.agreement_id)
      and other_sa.status = 'complete'
      and other_sa.membership_id = other_m.id
      and other_sa.presentation_id = p.id
    where p.membership_id is null
      and other_m.presentation_id = p.id
      and other_m.id <> m.id
  )
on conflict (membership_id) where membership_id is not null do update
set presentation_id = coalesce(
      public.sales_rep_attributions.presentation_id,
      excluded.presentation_id
    ),
    signed_agreement_id = coalesce(
      public.sales_rep_attributions.signed_agreement_id,
      excluded.signed_agreement_id
    ),
    lead_id = coalesce(
      public.sales_rep_attributions.lead_id,
      excluded.lead_id
    )
where public.sales_rep_attributions.rep_id = excluded.rep_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_rep_attributions_presentation_owner_fkey'
      and conrelid = 'public.sales_rep_attributions'::regclass
  ) then
    alter table public.sales_rep_attributions
      add constraint sales_rep_attributions_presentation_owner_fkey
      foreign key (presentation_id, rep_id)
      references public.presentations(id, sales_rep_id)
      on delete restrict;
  end if;
end
$$;

alter table public.presentations enable row level security;
alter table public.sales_rep_attributions enable row level security;
alter table public.sales_rep_activity_events enable row level security;

-- Presentations originated with an early anonymous-all policy. The modern app
-- reads and writes them through admin-authenticated server routes, so remove
-- any remaining browser-role policy before storing salesperson lineage.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'presentations'
      and (
        'anon' = any(roles)
        or 'authenticated' = any(roles)
        or 'public' = any(roles)
      )
  loop
    execute format(
      'drop policy if exists %I on public.presentations',
      pol.policyname
    );
  end loop;
end
$$;

revoke all privileges on table public.sales_rep_attributions
  from public, anon, authenticated;
revoke all privileges on table public.presentations
  from public, anon, authenticated;
revoke insert, update, delete on table public.sales_rep_activity_events
  from public, anon, authenticated;

grant select, insert on table public.sales_rep_attributions
  to service_role;
revoke update on table public.sales_rep_attributions from service_role;
grant update (
  lead_id,
  qualification_status,
  membership_started_at,
  retention_qualifies_at,
  qualified_at,
  updated_at
) on table public.sales_rep_attributions to service_role;
grant select, insert, update, delete on table public.presentations
  to service_role;
grant select, insert on table public.sales_rep_activity_events
  to service_role;

comment on column public.presentations.sales_rep_id is
  'Stable server-resolved representative lineage; browser creator labels are not authoritative';
comment on column public.presentations.sales_rep_lead_id is
  'Optional originating D2D lead owned by the presentation representative';
comment on column public.sales_rep_attributions.attributed_arr_cents is
  'Immutable close-time ARR snapshot sourced from memberships.annual_rate';
comment on column public.sales_rep_attributions.attribution_source is
  'Authoritative attribution trigger; agreement_signature is created after a successful membership signature';
comment on column public.sales_rep_attributions.attributed_at is
  'Business event time used for signed-today and closed-ARR reporting';
comment on column public.sales_rep_activity_events.client_event_id is
  'Optional device-generated UUID used to deduplicate weak-network retries';

-- Keep Production Health's privacy count aware of the newly hardened
-- presentations table without changing the function's public return shape.
create or replace function public.homeatlas_security_posture()
returns table(
  customer_public_policy_count bigint,
  customer_public_privilege_count bigint,
  admin_rate_limit_ready boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sensitive_tables(table_name) as (
    values
      ('homeowners'),
      ('properties'),
      ('home_care_plans'),
      ('memberships'),
      ('signed_agreements'),
      ('property_assets'),
      ('presentations'),
      ('lead_intakes'),
      ('customer_contact_points'),
      ('customer_communication_automation_rules'),
      ('customer_conversations'),
      ('customer_messages'),
      ('customer_communication_webhook_events'),
      ('customer_contact_consent_events'),
      ('customer_communication_provider_verifications'),
      ('google_business_connections'),
      ('sales_reps'),
      ('sales_rep_leads'),
      ('sales_rep_activity_events'),
      ('sales_rep_attributions')
  ),
  public_roles(role_name) as (
    values ('anon'), ('authenticated')
  ),
  table_privileges(privilege_name) as (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  )
  select
    (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in (select table_name from sensitive_tables)
        and (
          'anon' = any(p.roles)
          or 'authenticated' = any(p.roles)
          or 'public' = any(p.roles)
        )
    ),
    (
      select count(*)
      from sensitive_tables t
      cross join public_roles r
      cross join table_privileges p
      where has_table_privilege(
        r.role_name,
        format('public.%I', t.table_name),
        p.privilege_name
      )
    ),
    to_regclass('public.admin_unlock_rate_limits') is not null;
$$;

revoke all on function public.homeatlas_security_posture()
  from public, anon, authenticated;
grant execute on function public.homeatlas_security_posture()
  to service_role;

commit;
