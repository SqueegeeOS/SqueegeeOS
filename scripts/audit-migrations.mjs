#!/usr/bin/env node
/**
 * Read-only production migration ledger.
 *
 * This does not trust a migration-history table because several HomeAtlas
 * migrations were applied manually. Instead it verifies the durable schema
 * effect of every numbered migration.
 *
 * Usage: npm run audit:migrations
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Environment variables may be supplied by CI instead.
  }
}

loadEnvLocal();

const migration036Source = readFileSync(
  resolve(
    process.cwd(),
    "lib/persistence/supabase/migrations/036_hq_authority_input_closure.sql",
  ),
  "utf8",
);
const migration037Source = readFileSync(
  resolve(
    process.cwd(),
    "lib/persistence/supabase/migrations/037_stripe_setup_authorization.sql",
  ),
  "utf8",
);

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

function hasTable(snapshot, table) {
  return snapshot.tables.has(table);
}

function hasColumn(snapshot, table, column) {
  return snapshot.columns.has(`${table}.${column}`);
}

function constraintIncludes(snapshot, table, ...parts) {
  return snapshot.constraints.some(
    (row) =>
      row.table_name === table &&
      parts.every((part) => row.definition.toLowerCase().includes(part)),
  );
}

function functionConfigIncludes(snapshot, name, value) {
  return (snapshot.functionConfigs.get(name) ?? "").includes(value);
}

function normalizeSql(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeConstraintDefinition(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeFunctionBody(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function expectedConstraintDefinitions() {
  const block = migration037Source.match(
    /with expected\(table_name, constraint_name, canonical_definition\) as \(values([\s\S]*?)\n  \), actual as/,
  )?.[1];
  if (!block) throw new Error("Migration 037 exact constraint guard is missing");
  return Array.from(
    block.matchAll(/\('([^']+)', '([^']+)', '((?:''|[^'])*)'\)/g),
    (match) => ({
      table_name: match[1],
      constraint_name: match[2],
      canonical_definition: match[3].replaceAll("''", "'"),
    }),
  ).sort((left, right) =>
    `${left.table_name}.${left.constraint_name}`.localeCompare(
      `${right.table_name}.${right.constraint_name}`,
    ),
  );
}

function expectedFunctionBody(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = migration037Source.match(
    new RegExp(
      `create or replace function public\\.${escaped}\\([\\s\\S]*?\\nas \\$\\$([\\s\\S]*?)\\n\\$\\$;`,
      "i",
    ),
  )?.[1];
  if (body === undefined) {
    throw new Error(`Migration 037 function body is missing: ${name}`);
  }
  return normalizeFunctionBody(body);
}

function expectedMigration036FunctionBody(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = migration036Source.match(
    new RegExp(
      `create or replace function public\\.${escaped}\\([\\s\\S]*?\\nas \\$\\$([\\s\\S]*?)\\n\\$\\$;`,
      "i",
    ),
  )?.[1];
  if (body === undefined) {
    throw new Error(`Migration 036 function body is missing: ${name}`);
  }
  return normalizeFunctionBody(body);
}

function exactJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function hasExactAuthorityFunctionAcl(rows, expectedFunctionNames) {
  const expectedNames = [...expectedFunctionNames].sort();
  const rowsByFunction = new Map();

  for (const row of rows) {
    const functionName = String(row.routine_name);
    if (!expectedNames.includes(functionName)) return false;

    const functionOid = String(row.function_oid);
    const ownerOid = String(row.owner_oid);
    const ownerName = String(row.owner_name);
    const existing = rowsByFunction.get(functionName) ?? {
      functionOids: new Set(),
      ownerOids: new Set(),
      ownerNames: new Set(),
      ownerRows: 0,
      serviceRows: 0,
    };
    existing.functionOids.add(functionOid);
    existing.ownerOids.add(ownerOid);
    existing.ownerNames.add(ownerName);

    const isOwner = row.is_owner === true;
    if (isOwner) {
      if (
        String(row.grantee_oid) !== ownerOid ||
        String(row.grantee_name) !== ownerName ||
        row.privilege_type !== "EXECUTE"
      ) {
        return false;
      }
      existing.ownerRows += 1;
    } else {
      if (
        row.grantee_name !== "service_role" ||
        row.privilege_type !== "EXECUTE" ||
        row.is_grantable !== false
      ) {
        return false;
      }
      existing.serviceRows += 1;
    }

    rowsByFunction.set(functionName, existing);
  }

  return (
    exactJson([...rowsByFunction.keys()].sort(), expectedNames) &&
    [...rowsByFunction.values()].every(
      (entry) =>
        entry.functionOids.size === 1 &&
        entry.ownerOids.size === 1 &&
        entry.ownerNames.size === 1 &&
        entry.ownerRows === 1 &&
        entry.serviceRows === 1,
    )
  );
}

export function isExactSignedAgreementImmutabilityTrigger(
  rows,
  expectedFunctionOid,
) {
  if (rows.length !== 1 || expectedFunctionOid == null) return false;

  const row = rows[0];
  return (
    row.table_schema === "public" &&
    row.table_name === "signed_agreements" &&
    row.trigger_name === "signed_agreements_complete_immutable" &&
    row.is_internal === false &&
    Number(row.trigger_type) === 27 &&
    row.enabled_state === "O" &&
    String(row.function_oid) === String(expectedFunctionOid) &&
    row.function_schema === "public" &&
    row.function_name === "reject_completed_signed_agreement_mutation"
  );
}

const stripeSetupTables = [
  "membership_payment_setup_events",
  "membership_stripe_setup_reconciliation_attempts",
  "membership_stripe_setup_reconciliation_events",
];

const checks = [
  ["002", "closed jobs", (s) => hasTable(s, "closed_jobs")],
  ["003", "Headquarters profile", (s) => hasTable(s, "headquarters_profile")],
  ["004", "Headquarters initialized", (s) => hasColumn(s, "headquarters_profile", "headquarters_initialized")],
  ["005", "member intelligence", (s) => hasTable(s, "member_profiles") && hasTable(s, "member_appointments") && hasColumn(s, "properties", "property_details")],
  ["006", "presentations", (s) => hasTable(s, "presentations")],
  ["007", "SqueegeeKing tiers", (s) => constraintIncludes(s, "presentations", "biannual", "quarterly")],
  ["008", "pricing settings", (s) => hasTable(s, "pricing_settings")],
  ["009", "lead intakes", (s) => hasTable(s, "lead_intakes")],
  ["010", "quote snapshot", (s) => hasColumn(s, "presentations", "quote_snapshot")],
  ["011", "visit health checks", (s) => hasTable(s, "property_visit_health_checks")],
  ["012", "property assessments", (s) => hasTable(s, "property_assessments")],
  ["013", "membership onboarding", (s) => hasColumn(s, "memberships", "presentation_id") && hasColumn(s, "memberships", "payment_setup_completed_at") && hasColumn(s, "presentations", "onboarding_status")],
  ["014", "agreement storage bucket", (s) => s.agreementBucket !== null],
  ["015", "founding member", (s) => hasColumn(s, "memberships", "founding_member")],
  ["016", "portal access token", (s) => hasColumn(s, "memberships", "portal_access_token")],
  ["017", "private agreement storage", (s) => s.agreementBucket === false],
  ["018", "obligations", (s) => hasTable(s, "obligations") && hasTable(s, "obligation_events")],
  ["019", "archived lead status", (s) => constraintIncludes(s, "lead_intakes", "archived")],
  ["020", "visit-note assessment", (s) => s.enumValues.has("assessment_type.visit_note")],
  ["021", "visit-rate overrides", (s) => hasColumn(s, "memberships", "visit_rate_overrides") && hasColumn(s, "memberships", "override_tier")],
  ["022", "website membership sales", (s) => hasTable(s, "website_membership_sales")],
  ["023", "enrollment savings", (s) => hasColumn(s, "signed_agreements", "enrollment_savings") && hasColumn(s, "memberships", "membership_enrollment_savings")],
  ["024", "membership billing charges", (s) => hasTable(s, "membership_billing_charges")],
  ["025", "billing ledger v1.1", (s) => hasColumn(s, "membership_billing_charges", "amount_collected") && hasColumn(s, "membership_billing_charges", "stripe_reference")],
  ["026", "referral program", (s) => hasTable(s, "referral_codes") && hasTable(s, "referral_visits") && hasTable(s, "referrals")],
  ["027", "member add-ons", (s) => hasTable(s, "member_addon_transactions")],
  ["028", "savings and referral ledgers", (s) => hasTable(s, "member_savings_ledger_entries") && hasTable(s, "member_referral_rewards")],
  ["029", "portal theme preference", (s) => hasColumn(s, "memberships", "portal_theme"), "optional/parked"],
  ["030", "security hardening", (s) => ["referral_codes", "referral_visits", "referrals"].every((table) => s.rlsTables.has(table)) && s.referralAnonPolicies === 0 && s.secureUpdatedAt],
  ["031", "Care Operations foundation", (s) => ["appointment_source_events", "atlas_pricing_snapshots", "billing_orders", "billing_order_events"].every((table) => hasTable(s, table) && s.rlsTables.has(table))],
  ["032", "Jobber OAuth connection", (s) => ["jobber_connections", "jobber_connection_events"].every((table) => hasTable(s, table) && s.rlsTables.has(table))],
  ["033", "Jobber visit sample", (s) => hasTable(s, "jobber_visit_projections") && s.rlsTables.has("jobber_visit_projections")],
  ["034", "supervised Jobber property links", (s) => ["jobber_property_links", "jobber_property_link_events"].every((table) => hasTable(s, table) && s.rlsTables.has(table))],
  ["035", "authenticated Headquarters access", (s) => ["hq_admin_users", "hq_admin_user_events", "hq_magic_link_request_events", "hq_magic_link_delivery_events"].every((table) => hasTable(s, table) && s.rlsTables.has(table)) && hasColumn(s, "hq_admin_users", "active") && hasColumn(s, "hq_admin_users", "role") && s.hqAuthAnonPolicies === 0 && ["reserve_hq_magic_link_request", "validate_hq_admin_user_auth_email", "sync_hq_admin_user_auth_email", "record_hq_admin_user_change", "save_jobber_connection_with_event", "acquire_jobber_refresh_lease_for_generation", "complete_jobber_refresh_with_event", "fail_jobber_refresh_with_event"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog")) && ["public.hq_admin_users.hq_admin_users_validate_auth_email", "public.hq_admin_users.hq_admin_users_record_change", "public.hq_admin_user_events.hq_admin_user_events_immutable", "auth.users.hq_admin_users_sync_auth_email"].every((name) => s.triggers.has(name))],
  ["036", "HQ authority input closure", (s) => s.authorityMutationPolicies === 0 && s.authorityMutationGrants === 0 && s.sensitiveCustomerReadPolicies === 0 && s.sensitiveCustomerReadGrants === 0 && s.homeCarePlanReadPolicies === 0 && s.presentationBrowserPolicies === 0 && s.authorityAclExact && s.authorityFunctionAclExact && s.signingIdempotencyIndexExact && s.propertyAddressIndexExact && s.signedAgreementImmutabilityFunctionExact && s.signedAgreementImmutabilityTriggerExact && hasTable(s, "presentation_signing_attempts") && s.rlsTables.has("presentation_signing_attempts") && hasColumn(s, "presentations", "authority_sha256") && hasColumn(s, "signed_agreements", "signing_attempt_id") && hasColumn(s, "properties", "authority_address_key") && ["save_hq_home_care_plan", "claim_presentation_signing_attempt", "finalize_presentation_signing_attempt", "reject_completed_signed_agreement_mutation"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog"))],
  ["037", "Stripe setup authorization", (s) => hasColumn(s, "memberships", "stripe_setup_intent_id") && stripeSetupTables.every((table) => hasTable(s, table) && s.rlsTables.has(table)) && s.stripeSetupIndexExact && s.stripeCustomerIndexExact && s.stripeSetupColumnsExact && s.stripeSetupEvidenceConstraintsExact && s.stripeSetupEvidenceAclExact && s.stripeSetupFunctionAclExact && s.stripeSetupFunctionDefinitionsExact && s.stripeSetupTriggerExact],
  ["038", "Jobber schedule coverage sync", (s) => ["jobber_schedule_sync_runs", "jobber_schedule_sync_partitions", "jobber_visit_source_observations", "jobber_schedule_sync_watermarks", "jobber_schedule_sync_locks"].every((table) => hasTable(s, table) && s.rlsTables.has(table)) && ["begin_jobber_schedule_coverage_sync", "renew_jobber_schedule_coverage_sync_lease", "append_jobber_schedule_coverage_leaf", "complete_jobber_schedule_coverage_pass", "finalize_jobber_schedule_coverage_sync", "reconcile_jobber_schedule_coverage_finalization", "mark_jobber_schedule_coverage_sync_partial"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog"))],
  ["039", "Jobber visit classification", (s) => ["jobber_visit_classifications", "jobber_visit_classification_events"].every((table) => hasTable(s, table) && s.rlsTables.has(table)) && ["decide_jobber_visit_classification", "revoke_jobber_visit_classification", "invalidate_jobber_visit_classification_on_link_change"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog"))],
  ["040", "Jobber member-property search link", (s) => ["jobber_client_id", "jobber_property_web_uri", "observed_graphql_version", "ownership_observed_at", "ownership_pages_scanned", "property_coverage_complete"].every((column) => hasColumn(s, "jobber_property_links", column) && hasColumn(s, "jobber_property_link_events", column)) && s.functions.has("link_jobber_member_property_from_search") && functionConfigIncludes(s, "link_jobber_member_property_from_search", "search_path=pg_catalog")],
  ["041", "Jobber property-link revocation", (s) => ["revocation_projection_id", "revocation_expected_link_updated_at"].every((column) => hasColumn(s, "jobber_property_links", column) && hasColumn(s, "jobber_property_link_events", column)) && ["jobber_property_links", "jobber_property_link_events", "jobber_visit_classifications", "jobber_visit_classification_events", "member_appointments"].every((table) => s.rlsTables.has(table)) && ["revoke_jobber_property_link", "invalidate_jobber_visit_authority_for_property_link", "invalidate_jobber_visit_classification_on_link_change"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog"))],
];

if (isDirectExecution && !dbUrl) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL in .env.local");
  process.exit(2);
}

if (isDirectExecution) {
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
try {
  await client.query("begin read only");

  const [tables, columns, constraints, enums, rls, referralPolicies, hqAuthPolicies, authorityPolicies, authorityGrants, sensitiveReadPolicies, sensitiveReadGrants, homeCarePlanReadPolicies, presentationPolicies, functions, triggers, updatedAt, signingIndex, propertyAddressIndex, storageTable, authorityTableAcls, authorityFunctionAcls, authorityFunctionDetails, authorityTriggers, stripeSetupIndex, stripeCustomerIndex, stripeSetupColumns, stripeSetupEvidenceAcls, stripeSetupFunctionAcls, stripeSetupFunctionDetails, stripeSetupTriggers] = await Promise.all([
    client.query("select table_name from information_schema.tables where table_schema = 'public'"),
    client.query("select table_name, column_name from information_schema.columns where table_schema = 'public'"),
    client.query("select c.relname as table_name, k.conname as constraint_name, pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'"),
    client.query("select t.typname as type_name, e.enumlabel as value from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'"),
    client.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('referral_codes', 'referral_visits', 'referrals') and ('anon' = any(roles) or 'public' = any(roles))"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('hq_admin_users', 'hq_admin_user_events', 'hq_magic_link_request_events', 'hq_magic_link_delivery_events') and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles))"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations') and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE') and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations') and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('homeowners', 'properties', 'memberships', 'signed_agreements', 'property_assets') and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'memberships', 'signed_agreements', 'property_assets') and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type = 'SELECT'"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'home_care_plans' and cmd = 'SELECT' and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'presentations' and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select p.proname, coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"),
    client.query("select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public', 'auth')"),
    client.query("select coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at' limit 1"),
    client.query("select i.indisunique, pg_get_indexdef(i.indexrelid) as definition, pg_get_expr(i.indpred, i.indrelid) as predicate, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.signed_agreements_complete_presentation_uidx') group by i.indisunique, i.indexrelid, i.indpred, i.indrelid"),
    client.query("select i.indisunique, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.properties_authority_address_uidx') group by i.indisunique"),
    client.query("select to_regclass('storage.buckets') is not null as exists"),
    client.query("select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations', 'presentation_signing_attempts') and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role') order by grantee, table_name, privilege_type"),
    client.query("select p.oid::text as function_oid, p.proname as routine_name, p.proowner::text as owner_oid, owner_role.rolname as owner_name, acl.grantee::text as grantee_oid, case when acl.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee_name, acl.grantee = p.proowner as is_owner, acl.privilege_type, acl.is_grantable from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace join pg_catalog.pg_roles owner_role on owner_role.oid = p.proowner cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee where n.nspname = 'public' and p.proname in ('save_hq_home_care_plan', 'claim_presentation_signing_attempt', 'finalize_presentation_signing_attempt', 'reject_completed_signed_agreement_mutation') order by p.proname, p.oid, acl.grantee, acl.privilege_type"),
    client.query("select p.oid::text as function_oid, n.nspname as function_schema, p.proname, pg_catalog.oidvectortypes(p.proargtypes) as argument_types, p.proargnames as argument_names, pg_catalog.pg_get_expr(p.proargdefaults, 0) as argument_defaults, pg_catalog.pg_get_function_result(p.oid) as result_type, l.lanname as language_name, p.prosecdef as security_definer, p.proisstrict as is_strict, p.provolatile as volatility, p.proparallel as parallel_mode, coalesce(array_to_string(p.proconfig, ','), '') as config, p.prosrc as body from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace join pg_catalog.pg_language l on l.oid = p.prolang where n.nspname = 'public' and p.proname = 'reject_completed_signed_agreement_mutation' order by p.proname, argument_types"),
    client.query("select table_namespace.nspname as table_schema, c.relname as table_name, t.tgname as trigger_name, t.tgisinternal as is_internal, t.tgtype::integer as trigger_type, t.tgenabled as enabled_state, t.tgfoid::text as function_oid, function_namespace.nspname as function_schema, p.proname as function_name from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid join pg_catalog.pg_namespace table_namespace on table_namespace.oid = c.relnamespace join pg_catalog.pg_proc p on p.oid = t.tgfoid join pg_catalog.pg_namespace function_namespace on function_namespace.oid = p.pronamespace where t.tgname = 'signed_agreements_complete_immutable' order by table_schema, table_name, trigger_name"),
    client.query("select i.indisunique, pg_get_expr(i.indpred, i.indrelid) as predicate, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.memberships_stripe_setup_intent_uidx') group by i.indisunique, i.indpred, i.indrelid"),
    client.query("select i.indisunique, pg_get_expr(i.indpred, i.indrelid) as predicate, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.memberships_stripe_customer_uidx') group by i.indisunique, i.indpred, i.indrelid"),
    client.query("select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default, numeric_precision, numeric_scale from information_schema.columns where table_schema = 'public' and table_name in ('membership_payment_setup_events', 'membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_events') order by table_name, ordinal_position"),
    client.query("select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('membership_payment_setup_events', 'membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_events') and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role') order by grantee, table_name, privilege_type"),
    client.query("select grantee, routine_name, privilege_type from information_schema.routine_privileges where specific_schema = 'public' and routine_name in ('reserve_membership_stripe_setup_reconciliation', 'append_membership_stripe_setup_reconciliation_event', 'claim_membership_stripe_setup', 'activate_membership_after_stripe_setup', 'reject_membership_payment_setup_event_change') and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role') order by grantee, routine_name, privilege_type"),
    client.query("select p.proname, pg_catalog.oidvectortypes(p.proargtypes) as argument_types, p.proargnames as argument_names, pg_catalog.pg_get_expr(p.proargdefaults, 0) as argument_defaults, pg_catalog.pg_get_function_result(p.oid) as result_type, l.lanname as language_name, p.prosecdef as security_definer, p.proisstrict as is_strict, p.provolatile as volatility, p.proparallel as parallel_mode, coalesce(array_to_string(p.proconfig, ','), '') as config, p.prosrc as body from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace join pg_catalog.pg_language l on l.oid = p.prolang where n.nspname = 'public' and p.proname in ('reserve_membership_stripe_setup_reconciliation', 'append_membership_stripe_setup_reconciliation_event', 'claim_membership_stripe_setup', 'activate_membership_after_stripe_setup', 'reject_membership_payment_setup_event_change') order by p.proname, argument_types"),
    client.query("select c.relname as table_name, t.tgname as trigger_name, pg_get_triggerdef(t.oid, false) as definition from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('membership_payment_setup_events', 'membership_stripe_setup_reconciliation_attempts', 'membership_stripe_setup_reconciliation_events') and not t.tgisinternal order by c.relname, t.tgname"),
  ]);

  let agreementBucket = null;
  if (storageTable.rows[0]?.exists) {
    const bucket = await client.query("select public from storage.buckets where id = 'signed-agreements' limit 1");
    agreementBucket = bucket.rows.length ? bucket.rows[0].public : null;
  }

  const browserTableAcl = authorityTableAcls.rows
    .filter((row) => ["PUBLIC", "anon", "authenticated"].includes(row.grantee))
    .map((row) => `${row.grantee}.${row.table_name}.${row.privilege_type}`);
  const expectedBrowserTableAcl = [];
  const serviceTableAcl = authorityTableAcls.rows
    .filter((row) => row.grantee === "service_role")
    .map((row) => `${row.table_name}.${row.privilege_type}`);
  const authorityTables = [
    "homeowners", "properties", "home_care_plans", "memberships",
    "signed_agreements", "property_assets", "presentations",
    "presentation_signing_attempts",
  ];
  const expectedServiceTableAcl = authorityTables.flatMap((table) =>
    ["DELETE", "INSERT", "SELECT", "UPDATE"].map((privilege) => `${table}.${privilege}`),
  ).sort();
  const expectedAuthorityFunctionNames = [
    "claim_presentation_signing_attempt",
    "finalize_presentation_signing_attempt",
    "reject_completed_signed_agreement_mutation",
    "save_hq_home_care_plan",
  ];
  const signedAgreementImmutabilityFunctionDetails =
    authorityFunctionDetails.rows.map((row) => ({
      function_oid: String(row.function_oid),
      function_schema: String(row.function_schema),
      proname: row.proname,
      argument_types: String(row.argument_types),
      argument_names: row.argument_names ?? null,
      argument_defaults:
        row.argument_defaults === null
          ? null
          : normalizeSql(row.argument_defaults),
      result_type: String(row.result_type),
      language_name: String(row.language_name),
      security_definer: row.security_definer === true,
      is_strict: row.is_strict === true,
      volatility: String(row.volatility),
      parallel_mode: String(row.parallel_mode),
      config: String(row.config),
      body: normalizeFunctionBody(row.body),
    }));
  const expectedSignedAgreementImmutabilityFunctions = [{
    function_oid:
      signedAgreementImmutabilityFunctionDetails.length === 1
        ? signedAgreementImmutabilityFunctionDetails[0].function_oid
        : null,
    function_schema: "public",
    proname: "reject_completed_signed_agreement_mutation",
    argument_types: "",
    argument_names: null,
    argument_defaults: null,
    result_type: "trigger",
    language_name: "plpgsql",
    security_definer: false,
    is_strict: false,
    volatility: "v",
    parallel_mode: "u",
    config: "search_path=pg_catalog",
    body: expectedMigration036FunctionBody(
      "reject_completed_signed_agreement_mutation",
    ),
  }];
  const expectedSignedAgreementImmutabilityFunctionOid =
    signedAgreementImmutabilityFunctionDetails.length === 1
      ? signedAgreementImmutabilityFunctionDetails[0].function_oid
      : null;
  const signingIndexRow = signingIndex.rows[0];
  const propertyAddressIndexRow = propertyAddressIndex.rows[0];
  const stripeSetupIndexRow = stripeSetupIndex.rows[0];
  const stripeCustomerIndexRow = stripeCustomerIndex.rows[0];
  const columnShape = (row) => ({
    table: row.table_name,
    name: row.column_name,
    type: row.data_type,
    udt: row.udt_name,
    nullable: row.is_nullable,
    default: row.column_default === null ? null : normalizeSql(row.column_default),
    precision: row.numeric_precision === null ? null : Number(row.numeric_precision),
    scale: row.numeric_scale === null ? null : Number(row.numeric_scale),
  });
  const expectedColumn = (
    table, name, type, udt, nullable = "NO", defaultValue = null,
    precision = null, scale = null,
  ) => ({
    table, name, type, udt, nullable, default: defaultValue,
    precision, scale,
  });
  const a = "membership_stripe_setup_reconciliation_attempts";
  const e = "membership_stripe_setup_reconciliation_events";
  const p = "membership_payment_setup_events";
  const stripeSetupExpectedColumns = [
    expectedColumn(p, "id", "uuid", "uuid", "NO", "gen_random_uuid()"),
    expectedColumn(p, "reconciliation_attempt_id", "uuid", "uuid"),
    expectedColumn(p, "membership_id", "uuid", "uuid"),
    expectedColumn(p, "presentation_id", "uuid", "uuid"),
    expectedColumn(p, "agreement_id", "uuid", "uuid"),
    expectedColumn(p, "homeowner_id", "uuid", "uuid"),
    expectedColumn(p, "property_id", "uuid", "uuid"),
    expectedColumn(p, "sales_tier", "text", "text"),
    expectedColumn(p, "visit_price", "numeric", "numeric", "NO", null, 10, 2),
    expectedColumn(p, "visits_per_year", "smallint", "int2", "NO", null, 16, 0),
    expectedColumn(p, "presentation_authority_sha256", "text", "text"),
    expectedColumn(p, "enrollment_savings", "numeric", "numeric", "NO", null, 10, 2),
    expectedColumn(p, "stripe_customer_id", "text", "text"),
    expectedColumn(p, "stripe_setup_intent_id", "text", "text"),
    expectedColumn(p, "stripe_payment_method_id", "text", "text"),
    expectedColumn(p, "stripe_livemode", "boolean", "bool"),
    expectedColumn(p, "stripe_setup_intent_status", "text", "text"),
    expectedColumn(p, "stripe_metadata", "jsonb", "jsonb"),
    expectedColumn(p, "payment_setup_completed_at", "timestamp with time zone", "timestamptz"),
    expectedColumn(p, "occurred_at", "timestamp with time zone", "timestamptz", "NO", "now()"),
    expectedColumn(a, "id", "uuid", "uuid", "NO", "gen_random_uuid()"),
    expectedColumn(a, "membership_id", "uuid", "uuid"),
    expectedColumn(a, "presentation_id", "uuid", "uuid"),
    expectedColumn(a, "agreement_id", "uuid", "uuid"),
    expectedColumn(a, "homeowner_id", "uuid", "uuid"),
    expectedColumn(a, "property_id", "uuid", "uuid"),
    expectedColumn(a, "capability_kind", "text", "text"),
    expectedColumn(a, "sales_tier", "text", "text"),
    expectedColumn(a, "visit_price", "numeric", "numeric", "NO", null, 10, 2),
    expectedColumn(a, "visits_per_year", "smallint", "int2", "NO", null, 16, 0),
    expectedColumn(a, "enrollment_savings", "numeric", "numeric", "NO", null, 10, 2),
    expectedColumn(a, "presentation_authority_sha256", "text", "text"),
    expectedColumn(a, "customer_idempotency_key", "text", "text"),
    expectedColumn(a, "setup_intent_idempotency_key", "text", "text"),
    expectedColumn(a, "operation_phase", "text", "text", "NO", "'before_provider'::text"),
    expectedColumn(a, "operation_status", "text", "text", "NO", "'reserved'::text"),
    expectedColumn(a, "created_at", "timestamp with time zone", "timestamptz", "NO", "now()"),
    expectedColumn(e, "id", "uuid", "uuid", "NO", "gen_random_uuid()"),
    expectedColumn(e, "attempt_id", "uuid", "uuid"),
    expectedColumn(e, "event_key", "text", "text"),
    expectedColumn(e, "operation_phase", "text", "text"),
    expectedColumn(e, "operation_status", "text", "text"),
    expectedColumn(e, "stripe_customer_id", "text", "text", "YES"),
    expectedColumn(e, "stripe_setup_intent_id", "text", "text", "YES"),
    expectedColumn(e, "outcome", "text", "text", "YES"),
    expectedColumn(e, "error_code", "text", "text", "YES"),
    expectedColumn(e, "occurred_at", "timestamp with time zone", "timestamptz", "NO", "now()"),
  ];
  const stripeSetupActualColumns = stripeSetupColumns.rows.map(columnShape);
  const stripeSetupBrowserEvidenceAcl = stripeSetupEvidenceAcls.rows.filter(
    (row) => ["PUBLIC", "anon", "authenticated"].includes(row.grantee),
  );
  const stripeSetupServiceEvidenceAcl = stripeSetupEvidenceAcls.rows
    .filter((row) => row.grantee === "service_role")
    .map((row) => `${row.table_name}.${row.privilege_type}`)
    .sort();
  const stripeSetupBrowserFunctionAcl = stripeSetupFunctionAcls.rows.filter(
    (row) => ["PUBLIC", "anon", "authenticated"].includes(row.grantee),
  );
  const stripeSetupServiceFunctionAcl = stripeSetupFunctionAcls.rows
    .filter((row) => row.grantee === "service_role")
    .map((row) => `${row.routine_name}.${row.privilege_type}`)
    .sort();
  const stripeSetupConstraints = constraints.rows.filter(
    (row) => stripeSetupTables.includes(row.table_name),
  );
  const expectedStripeConstraints = expectedConstraintDefinitions();
  const actualStripeConstraints = stripeSetupConstraints
    .map((row) => ({
      table_name: row.table_name,
      constraint_name: row.constraint_name,
      canonical_definition: normalizeConstraintDefinition(row.definition),
    }))
    .sort((left, right) =>
      `${left.table_name}.${left.constraint_name}`.localeCompare(
        `${right.table_name}.${right.constraint_name}`,
      ),
    );
  const stripeSetupFunctionDefinitionRows = stripeSetupFunctionDetails.rows.map(
    (row) => ({
      proname: row.proname,
      argument_types: String(row.argument_types),
      argument_names: row.argument_names ?? null,
      argument_defaults:
        row.argument_defaults === null
          ? null
          : normalizeSql(row.argument_defaults),
      result_type: String(row.result_type),
      language_name: String(row.language_name),
      security_definer: row.security_definer === true,
      is_strict: row.is_strict === true,
      volatility: String(row.volatility),
      parallel_mode: String(row.parallel_mode),
      config: String(row.config),
      body: normalizeFunctionBody(row.body),
    }),
  ).sort((left, right) => left.proname.localeCompare(right.proname));
  const expectedStripeFunctions = [
    {
      proname: "activate_membership_after_stripe_setup",
      argument_types: "uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean",
      argument_names: ["p_membership_id", "p_presentation_id", "p_agreement_id", "p_homeowner_id", "p_property_id", "p_expected_authority_sha256", "p_reconciliation_attempt_id", "p_stripe_customer_id", "p_stripe_setup_intent_id", "p_stripe_payment_method_id", "p_stripe_livemode"],
      argument_defaults: null,
      result_type: "jsonb",
      language_name: "plpgsql",
      security_definer: true,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body: expectedFunctionBody("activate_membership_after_stripe_setup"),
    },
    {
      proname: "append_membership_stripe_setup_reconciliation_event",
      argument_types: "uuid, text, text, text, text, text, text, text",
      argument_names: ["p_attempt_id", "p_event_key", "p_operation_phase", "p_operation_status", "p_stripe_customer_id", "p_stripe_setup_intent_id", "p_outcome", "p_error_code"],
      argument_defaults: null,
      result_type: "jsonb",
      language_name: "plpgsql",
      security_definer: true,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body: expectedFunctionBody("append_membership_stripe_setup_reconciliation_event"),
    },
    {
      proname: "claim_membership_stripe_setup",
      argument_types: "uuid, uuid, uuid, uuid, uuid, text, uuid, text, text",
      argument_names: ["p_membership_id", "p_presentation_id", "p_agreement_id", "p_homeowner_id", "p_property_id", "p_expected_authority_sha256", "p_reconciliation_attempt_id", "p_stripe_customer_id", "p_stripe_setup_intent_id"],
      argument_defaults: "null::text",
      result_type: "jsonb",
      language_name: "plpgsql",
      security_definer: false,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body: expectedFunctionBody("claim_membership_stripe_setup"),
    },
    {
      proname: "reject_membership_payment_setup_event_change",
      argument_types: "",
      argument_names: null,
      argument_defaults: null,
      result_type: "trigger",
      language_name: "plpgsql",
      security_definer: false,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body: expectedFunctionBody("reject_membership_payment_setup_event_change"),
    },
    {
      proname: "reserve_membership_stripe_setup_reconciliation",
      argument_types: "uuid, uuid, uuid, uuid, uuid, text, text",
      argument_names: ["p_membership_id", "p_presentation_id", "p_agreement_id", "p_homeowner_id", "p_property_id", "p_expected_authority_sha256", "p_capability_kind"],
      argument_defaults: null,
      result_type: "jsonb",
      language_name: "plpgsql",
      security_definer: true,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body: expectedFunctionBody("reserve_membership_stripe_setup_reconciliation"),
    },
  ];
  const expectedStripeTriggers = stripeSetupTables.map((table) => ({
    table_name: table,
    trigger_name: `${table}_immutable`,
    definition: normalizeSql(
      `create trigger ${table}_immutable before update or delete on public.${table} for each row execute function public.reject_membership_payment_setup_event_change()`,
    ),
  }));
  const actualStripeTriggers = stripeSetupTriggers.rows.map((row) => ({
    table_name: row.table_name,
    trigger_name: row.trigger_name,
    definition: normalizeSql(row.definition),
  }));
  const snapshot = {
    tables: new Set(tables.rows.map((row) => row.table_name)),
    columns: new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`)),
    constraints: constraints.rows.map((row) => ({
      table_name: row.table_name,
      constraint_name: row.constraint_name,
      definition: String(row.definition),
    })),
    enumValues: new Set(enums.rows.map((row) => `${row.type_name}.${row.value}`)),
    rlsTables: new Set(rls.rows.map((row) => row.relname)),
    referralAnonPolicies: referralPolicies.rows[0]?.count ?? 0,
    hqAuthAnonPolicies: hqAuthPolicies.rows[0]?.count ?? 0,
    authorityMutationPolicies: authorityPolicies.rows[0]?.count ?? 0,
    authorityMutationGrants: authorityGrants.rows[0]?.count ?? 0,
    sensitiveCustomerReadPolicies: sensitiveReadPolicies.rows[0]?.count ?? 0,
    sensitiveCustomerReadGrants: sensitiveReadGrants.rows[0]?.count ?? 0,
    homeCarePlanReadPolicies: homeCarePlanReadPolicies.rows[0]?.count ?? 0,
    presentationBrowserPolicies: presentationPolicies.rows[0]?.count ?? 0,
    functions: new Set(functions.rows.map((row) => row.proname)),
    functionConfigs: new Map(
      functions.rows.map((row) => [row.proname, String(row.config)]),
    ),
    triggers: new Set(triggers.rows.map((row) => `${row.schema_name}.${row.table_name}.${row.trigger_name}`)),
    secureUpdatedAt: updatedAt.rows.some((row) => String(row.config).includes("search_path=public")),
    authorityAclExact:
      JSON.stringify(browserTableAcl.sort()) ===
        JSON.stringify(expectedBrowserTableAcl.sort()) &&
      JSON.stringify(serviceTableAcl.sort()) ===
        JSON.stringify(expectedServiceTableAcl),
    authorityFunctionAclExact: hasExactAuthorityFunctionAcl(
      authorityFunctionAcls.rows,
      expectedAuthorityFunctionNames,
    ),
    signedAgreementImmutabilityFunctionExact:
      exactJson(
        signedAgreementImmutabilityFunctionDetails,
        expectedSignedAgreementImmutabilityFunctions,
      ),
    signedAgreementImmutabilityTriggerExact:
      isExactSignedAgreementImmutabilityTrigger(
        authorityTriggers.rows,
        expectedSignedAgreementImmutabilityFunctionOid,
      ),
    signingIdempotencyIndexExact:
      signingIndexRow?.indisunique === true &&
      JSON.stringify(signingIndexRow.columns) === JSON.stringify(["presentation_id"]) &&
      String(signingIndexRow.predicate).replaceAll('"', "") ===
        "((presentation_id IS NOT NULL) AND (status = 'complete'::text))",
    propertyAddressIndexExact:
      propertyAddressIndexRow?.indisunique === true &&
      JSON.stringify(propertyAddressIndexRow.columns) ===
        JSON.stringify(["authority_address_key"]),
    stripeSetupIndexExact:
      stripeSetupIndexRow?.indisunique === true &&
      JSON.stringify(stripeSetupIndexRow.columns) ===
        JSON.stringify(["stripe_setup_intent_id"]) &&
      String(stripeSetupIndexRow.predicate).includes("IS NOT NULL"),
    stripeCustomerIndexExact:
      stripeCustomerIndexRow?.indisunique === true &&
      JSON.stringify(stripeCustomerIndexRow.columns) ===
        JSON.stringify(["stripe_customer_id"]) &&
      String(stripeCustomerIndexRow.predicate).includes("IS NOT NULL"),
    stripeSetupColumnsExact: exactJson(
      stripeSetupActualColumns,
      stripeSetupExpectedColumns,
    ),
    stripeSetupEvidenceAclExact:
      stripeSetupBrowserEvidenceAcl.length === 0 &&
      JSON.stringify(stripeSetupServiceEvidenceAcl) ===
        JSON.stringify([
          "membership_payment_setup_events.SELECT",
          "membership_stripe_setup_reconciliation_attempts.SELECT",
          "membership_stripe_setup_reconciliation_events.SELECT",
        ]),
    stripeSetupEvidenceConstraintsExact:
      exactJson(actualStripeConstraints, expectedStripeConstraints),
    stripeSetupFunctionAclExact:
      stripeSetupBrowserFunctionAcl.length === 0 &&
      JSON.stringify(stripeSetupServiceFunctionAcl) ===
        JSON.stringify([
          "activate_membership_after_stripe_setup.EXECUTE",
          "append_membership_stripe_setup_reconciliation_event.EXECUTE",
          "claim_membership_stripe_setup.EXECUTE",
          "reject_membership_payment_setup_event_change.EXECUTE",
          "reserve_membership_stripe_setup_reconciliation.EXECUTE",
        ]),
    stripeSetupFunctionDetails: stripeSetupFunctionDefinitionRows,
    stripeSetupFunctionDefinitionsExact:
      exactJson(stripeSetupFunctionDefinitionRows, expectedStripeFunctions),
    stripeSetupTriggerExact:
      exactJson(actualStripeTriggers, expectedStripeTriggers),
    agreementBucket,
  };

  let missing = 0;
  console.log("HomeAtlas migration ledger (read-only)\n");
  for (const [id, label, verify, note] of checks) {
    const applied = verify(snapshot);
    if (!applied && note !== "optional/parked") missing += 1;
    const status = applied ? "PASS" : note === "optional/parked" ? "PARKED" : "MISSING";
    console.log(`${status.padEnd(7)} ${id}  ${label}`);
  }

  console.log(`\nRequired gaps: ${missing}`);
  if (missing > 0) process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
}
