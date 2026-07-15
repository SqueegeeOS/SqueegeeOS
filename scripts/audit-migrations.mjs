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

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL in .env.local");
  process.exit(2);
}

const client = new pg.Client({ connectionString: dbUrl });

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
  ["036", "HQ authority input closure", (s) => s.authorityMutationPolicies === 0 && s.authorityMutationGrants === 0 && s.sensitiveCustomerReadPolicies === 0 && s.sensitiveCustomerReadGrants === 0 && s.homeCarePlanReadPolicies === 1 && s.presentationBrowserPolicies === 0 && s.authorityAclExact && s.authorityFunctionAclExact && s.signingIdempotencyIndexExact && s.propertyAddressIndexExact && hasTable(s, "presentation_signing_attempts") && s.rlsTables.has("presentation_signing_attempts") && hasColumn(s, "presentations", "authority_sha256") && hasColumn(s, "signed_agreements", "signing_attempt_id") && hasColumn(s, "properties", "authority_address_key") && ["save_hq_home_care_plan", "claim_presentation_signing_attempt", "finalize_presentation_signing_attempt"].every((name) => s.functions.has(name) && functionConfigIncludes(s, name, "search_path=pg_catalog"))],
];

await client.connect();
try {
  await client.query("begin read only");

  const [tables, columns, constraints, enums, rls, referralPolicies, hqAuthPolicies, authorityPolicies, authorityGrants, sensitiveReadPolicies, sensitiveReadGrants, homeCarePlanReadPolicies, presentationPolicies, functions, triggers, updatedAt, signingIndex, propertyAddressIndex, storageTable, authorityTableAcls, authorityFunctionAcls] = await Promise.all([
    client.query("select table_name from information_schema.tables where table_schema = 'public'"),
    client.query("select table_name, column_name from information_schema.columns where table_schema = 'public'"),
    client.query("select c.relname as table_name, pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'"),
    client.query("select t.typname as type_name, e.enumlabel as value from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'"),
    client.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('referral_codes', 'referral_visits', 'referrals') and ('anon' = any(roles) or 'public' = any(roles))"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('hq_admin_users', 'hq_admin_user_events', 'hq_magic_link_request_events', 'hq_magic_link_delivery_events') and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles))"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations') and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE') and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations') and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('homeowners', 'properties', 'memberships', 'signed_agreements', 'property_assets') and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'memberships', 'signed_agreements', 'property_assets') and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type = 'SELECT'"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'home_care_plans' and cmd = 'SELECT' and roles::text[] && array['anon', 'authenticated']::text[]"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'presentations' and roles::text[] && array['public', 'anon', 'authenticated']::text[]"),
    client.query("select p.proname, coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"),
    client.query("select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public', 'auth')"),
    client.query("select coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at' limit 1"),
    client.query("select i.indisunique, pg_get_indexdef(i.indexrelid) as definition, pg_get_expr(i.indpred, i.indrelid) as predicate, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.signed_agreements_complete_presentation_uidx') group by i.indisunique, i.indexrelid, i.indpred, i.indrelid"),
    client.query("select i.indisunique, array_agg(a.attname order by k.ordinality) as columns from pg_index i join pg_class c on c.oid = i.indexrelid join lateral unnest(i.indkey) with ordinality k(attnum, ordinality) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where c.oid = to_regclass('public.properties_authority_address_uidx') group by i.indisunique"),
    client.query("select to_regclass('storage.buckets') is not null as exists"),
    client.query("select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'presentations', 'presentation_signing_attempts') and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role') order by grantee, table_name, privilege_type"),
    client.query("select grantee, routine_name, privilege_type from information_schema.routine_privileges where specific_schema = 'public' and routine_name in ('save_hq_home_care_plan', 'claim_presentation_signing_attempt', 'finalize_presentation_signing_attempt') and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role') order by grantee, routine_name, privilege_type"),
  ]);

  let agreementBucket = null;
  if (storageTable.rows[0]?.exists) {
    const bucket = await client.query("select public from storage.buckets where id = 'signed-agreements' limit 1");
    agreementBucket = bucket.rows.length ? bucket.rows[0].public : null;
  }

  const browserTableAcl = authorityTableAcls.rows
    .filter((row) => ["PUBLIC", "anon", "authenticated"].includes(row.grantee))
    .map((row) => `${row.grantee}.${row.table_name}.${row.privilege_type}`);
  const expectedBrowserTableAcl = [
    "anon.home_care_plans.SELECT",
    "authenticated.home_care_plans.SELECT",
  ];
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
  const browserFunctionAcl = authorityFunctionAcls.rows.filter((row) =>
    ["PUBLIC", "anon", "authenticated"].includes(row.grantee),
  );
  const serviceFunctionAcl = authorityFunctionAcls.rows
    .filter((row) => row.grantee === "service_role")
    .map((row) => `${row.routine_name}.${row.privilege_type}`)
    .sort();
  const expectedServiceFunctionAcl = [
    "claim_presentation_signing_attempt.EXECUTE",
    "finalize_presentation_signing_attempt.EXECUTE",
    "save_hq_home_care_plan.EXECUTE",
  ];
  const signingIndexRow = signingIndex.rows[0];
  const propertyAddressIndexRow = propertyAddressIndex.rows[0];
  const snapshot = {
    tables: new Set(tables.rows.map((row) => row.table_name)),
    columns: new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`)),
    constraints: constraints.rows.map((row) => ({
      table_name: row.table_name,
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
    authorityFunctionAclExact:
      browserFunctionAcl.length === 0 &&
      JSON.stringify(serviceFunctionAcl) ===
        JSON.stringify(expectedServiceFunctionAcl),
    signingIdempotencyIndexExact:
      signingIndexRow?.indisunique === true &&
      JSON.stringify(signingIndexRow.columns) === JSON.stringify(["presentation_id"]) &&
      String(signingIndexRow.predicate).replaceAll('"', "") ===
        "((presentation_id IS NOT NULL) AND (status = 'complete'::text))",
    propertyAddressIndexExact:
      propertyAddressIndexRow?.indisunique === true &&
      JSON.stringify(propertyAddressIndexRow.columns) ===
        JSON.stringify(["authority_address_key"]),
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
