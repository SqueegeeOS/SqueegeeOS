-- Reusable deterministic whole-row fingerprints for domains that Jobber
-- authority rehearsals must never mutate. Install in the same session that
-- captures and compares stages. Optional relations are recorded as absent.

create temporary table if not exists forbidden_domain_content_fingerprints (
  stage text not null,
  relation_name text not null,
  relation_present boolean not null,
  row_count bigint,
  content_sha256 text,
  primary key (stage, relation_name),
  check (nullif(pg_catalog.btrim(stage), '') is not null),
  check (
    (relation_present and row_count is not null and content_sha256 ~ '^[0-9a-f]{64}$')
    or (not relation_present and row_count is null and content_sha256 is null)
  )
);
truncate table forbidden_domain_content_fingerprints;

create or replace function pg_temp.capture_forbidden_domain_content(
  requested_stage text
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  relation_name text;
  relation_oid regclass;
  pgcrypto_schema name;
begin
  if nullif(pg_catalog.btrim(coalesce(requested_stage, '')), '') is null then
    raise exception 'Invalid forbidden-domain fingerprint stage';
  end if;

  select namespace.nspname into pgcrypto_schema
  from pg_catalog.pg_extension extension
  join pg_catalog.pg_namespace namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';
  if pgcrypto_schema is null then
    raise exception 'pgcrypto is required for deterministic content fingerprints';
  end if;

  delete from forbidden_domain_content_fingerprints
  where stage = requested_stage;

  foreach relation_name in array array[
    'public.obligations',
    'public.obligation_events',
    'public.pricing_settings',
    'public.atlas_pricing_snapshots',
    'public.billing_orders',
    'public.billing_order_events',
    'public.membership_billing_charges',
    'public.stripe_event_ledger',
    'public.payment_reconciliation_cases',
    'public.membership_payment_setup_events',
    'public.membership_stripe_setup_reconciliation_attempts',
    'public.membership_stripe_setup_reconciliation_events',
    'public.signed_agreements',
    'public.presentation_signing_attempts',
    'public.memberships',
    'public.member_savings_transactions',
    'public.member_savings_ledger_entries',
    'public.member_referral_rewards',
    'public.referral_codes',
    'public.referral_visits',
    'public.referrals',
    'public.member_addon_transactions',
    'public.property_assets',
    'storage.objects',
    'public.property_visit_health_checks',
    'public.property_assessments',
    'public.service_observations',
    'public.properties',
    'public.homeowners',
    'public.home_care_plans',
    'public.presentations',
    'public.website_membership_sales',
    'public.ai_quotes',
    'public.appointment_source_events'
  ] loop
    relation_oid := pg_catalog.to_regclass(relation_name);
    if relation_oid is null then
      insert into forbidden_domain_content_fingerprints (
        stage, relation_name, relation_present, row_count, content_sha256
      ) values (requested_stage, relation_name, false, null, null);
    else
      execute pg_catalog.format(
        'insert into forbidden_domain_content_fingerprints '
        '(stage, relation_name, relation_present, row_count, content_sha256) '
        'select %L, %L, true, count(*), '
        'pg_catalog.encode(%I.digest(coalesce(pg_catalog.string_agg(row_data::text, E''\\n'' order by row_data::text), ''''), ''sha256''), ''hex'') '
        'from (select pg_catalog.to_jsonb(source_row) as row_data from %s source_row) fingerprint_rows',
        requested_stage,
        relation_name,
        pgcrypto_schema,
        relation_oid
      );
    end if;
  end loop;
end;
$$;

create or replace function pg_temp.assert_forbidden_domain_content_unchanged(
  before_stage text,
  after_stage text
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  changed_relations text;
begin
  select pg_catalog.string_agg(
    coalesce(before_state.relation_name, after_state.relation_name),
    ', ' order by coalesce(before_state.relation_name, after_state.relation_name)
  ) into changed_relations
  from (
    select * from forbidden_domain_content_fingerprints
    where stage = before_stage
  ) before_state
  full join (
    select * from forbidden_domain_content_fingerprints
    where stage = after_stage
  ) after_state using (relation_name)
  where before_state.relation_name is null
    or after_state.relation_name is null
    or before_state.relation_present is distinct from after_state.relation_present
    or before_state.row_count is distinct from after_state.row_count
    or before_state.content_sha256 is distinct from after_state.content_sha256;

  if changed_relations is not null then
    raise exception 'Forbidden-domain fingerprints changed: %', changed_relations;
  end if;
  if not exists (
    select 1 from forbidden_domain_content_fingerprints where stage = before_stage
  ) or not exists (
    select 1 from forbidden_domain_content_fingerprints where stage = after_stage
  ) then
    raise exception 'Forbidden-domain fingerprint stage is missing';
  end if;
end;
$$;
