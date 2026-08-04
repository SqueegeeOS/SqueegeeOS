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

function hasColumns(snapshot, table, ...columns) {
  return columns.every((column) => hasColumn(snapshot, table, column));
}

function constraintIncludes(snapshot, table, ...parts) {
  return snapshot.constraints.some(
    (row) =>
      row.table_name === table &&
      parts.every((part) => row.definition.toLowerCase().includes(part)),
  );
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
  ["031", "care operations foundation", (s) => hasTable(s, "atlas_pricing_snapshots") && hasTable(s, "billing_orders") && hasColumn(s, "member_appointments", "provider")],
  ["032", "Jobber OAuth connection", (s) => hasTable(s, "jobber_connections") && hasTable(s, "jobber_connection_events")],
  ["033", "Jobber visit projection", (s) => hasTable(s, "jobber_visit_projections")],
  ["034", "Jobber supervised property links", (s) => hasTable(s, "jobber_property_links")],
  ["035", "Jobber full sync and customer links", (s) => hasTable(s, "jobber_client_projections") && hasTable(s, "jobber_customer_links")],
  ["036", "Atlas Pulse delivery and webhooks", (s) => hasTable(s, "membership_communications") && hasTable(s, "resend_webhook_events") && hasTable(s, "jobber_webhook_events")],
  ["037", "Atlas Pulse manual completion", (s) => hasTable(s, "membership_activation_confirmations") && hasTable(s, "membership_activation_confirmation_events")],
  ["038", "customer data boundary", (s) => hasTable(s, "admin_unlock_rate_limits") && s.customerPublicPolicies === 0 && s.customerPublicPrivileges === 0],
  ["039", "membership history", (s) => s.indexes.has("memberships_one_current_per_property_idx")],
  ["040", "lead request privacy boundary", (s) => s.customerPublicPolicies === 0 && s.customerPublicPrivileges === 0],
  ["041", "customer communications", (s) => hasTable(s, "customer_contact_points") && hasTable(s, "customer_conversations") && hasTable(s, "customer_messages") && hasTable(s, "customer_communication_webhook_events") && hasColumn(s, "lead_intakes", "sms_consent_status") && hasColumn(s, "lead_intakes", "email_delivery_status") && s.customerPublicPolicies === 0 && s.customerPublicPrivileges === 0],
  ["042", "Google Business full reviews", (s) => hasTable(s, "google_business_connections") && hasColumns(s, "google_business_connections", "account_name", "location_name", "place_id", "oauth_email", "access_token_ciphertext", "refresh_token_ciphertext", "token_generation", "connection_revision") && s.nullableColumns.has("google_business_connections.place_id") && s.nullableColumns.has("google_business_connections.oauth_email") && s.rlsTables.has("google_business_connections") && s.googlePublicPolicies === 0 && s.googlePublicPrivileges === 0 && s.googleServicePrivileges === 4 && s.googleSecurityPosture],
  ["043", "automatic membership billing", (s) => hasTable(s, "billing_automation_settings") && hasTable(s, "billing_automation_runs") && hasTable(s, "billing_attempts") && hasColumn(s, "memberships", "automatic_billing_enabled") && hasColumns(s, "billing_orders", "due_at", "stripe_payment_intent_id", "lease_expires_at") && hasColumn(s, "membership_billing_charges", "appointment_id") && s.rlsTables.has("billing_automation_settings") && s.rlsTables.has("billing_automation_runs") && s.rlsTables.has("billing_attempts")],
  ["044", "SMS consent evidence", (s) => hasColumns(s, "lead_intakes", "sms_consent_disclosure_version", "sms_consent_source_path", "sms_consent_ip_address", "sms_consent_user_agent")],
  ["045", "communications consent and provider readiness", (s) => hasTable(s, "customer_contact_consent_events") && hasTable(s, "customer_communication_provider_verifications") && s.rlsTables.has("customer_contact_consent_events") && s.rlsTables.has("customer_communication_provider_verifications")],
  ["046", "Jobber scheduled-service billing", (s) => hasColumns(s, "jobber_visit_projections", "job_type", "job_billing_type", "job_total_cents", "job_will_auto_charge", "visit_invoice_id", "is_last_scheduled_visit") && s.nullableColumns.has("billing_orders.obligation_id") && s.nullableColumns.has("atlas_pricing_snapshots.obligation_id") && s.indexes.has("billing_orders_active_appointment_unique") && s.indexes.has("membership_billing_charges_automatic_appointment_unique")],
  ["047", "Jobber invoice visibility fail-closed", (s) => constraintIncludes(s, "jobber_visit_projections", "job_will_auto_charge", "visit_invoice_status", "none")],
  ["048", "private sales representative workspace", (s) => hasTable(s, "sales_reps") && hasTable(s, "sales_rep_leads") && hasTable(s, "sales_rep_activity_events") && hasTable(s, "sales_rep_attributions") && hasColumns(s, "sales_rep_leads", "sms_consent_status", "sms_consent_recorded_at", "next_follow_up_at") && ["sales_reps", "sales_rep_leads", "sales_rep_activity_events", "sales_rep_attributions"].every((table) => s.rlsTables.has(table)) && s.customerPublicPolicies === 0 && s.customerPublicPrivileges === 0],
  ["049", "audit-safe sales activity reversal", (s) => hasColumns(s, "sales_rep_activity_events", "reversed_at", "reversed_by", "reversal_reason") && constraintIncludes(s, "sales_rep_activity_events", "reversed_at", "reversed_by", "reversal_reason") && s.rlsTables.has("sales_rep_activity_events") && s.customerPublicPolicies === 0 && s.customerPublicPrivileges === 0],
];

await client.connect();
try {
  await client.query("begin read only");

  const [tables, columns, constraints, indexes, enums, rls, referralPolicies, customerPolicies, customerPrivileges, googlePolicies, googlePublicPrivileges, googleServicePrivileges, updatedAt, securityPosture, storageTable] = await Promise.all([
    client.query("select table_name from information_schema.tables where table_schema = 'public'"),
    client.query("select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public'"),
    client.query("select c.relname as table_name, pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'"),
    client.query("select indexname from pg_indexes where schemaname = 'public'"),
    client.query("select t.typname as type_name, e.enumlabel as value from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'"),
    client.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('referral_codes', 'referral_visits', 'referrals') and ('anon' = any(roles) or 'public' = any(roles))"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('homeowners', 'properties', 'home_care_plans', 'memberships', 'signed_agreements', 'property_assets', 'lead_intakes', 'customer_contact_points', 'customer_communication_automation_rules', 'customer_conversations', 'customer_messages', 'customer_communication_webhook_events', 'customer_contact_consent_events', 'customer_communication_provider_verifications', 'sales_reps', 'sales_rep_leads', 'sales_rep_activity_events', 'sales_rep_attributions') and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles))"),
    client.query("with customer_tables(table_name) as (values ('homeowners'), ('properties'), ('home_care_plans'), ('memberships'), ('signed_agreements'), ('property_assets'), ('lead_intakes'), ('customer_contact_points'), ('customer_communication_automation_rules'), ('customer_conversations'), ('customer_messages'), ('customer_communication_webhook_events'), ('customer_contact_consent_events'), ('customer_communication_provider_verifications'), ('sales_reps'), ('sales_rep_leads'), ('sales_rep_activity_events'), ('sales_rep_attributions')), public_roles(role_name) as (values ('anon'), ('authenticated')), table_privileges(privilege_name) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) select count(*)::int as count from customer_tables t cross join public_roles r cross join table_privileges p where to_regclass(format('public.%I', t.table_name)) is not null and has_table_privilege(r.role_name, to_regclass(format('public.%I', t.table_name)), p.privilege_name)"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'google_business_connections' and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles))"),
    client.query("with public_roles(role_name) as (values ('anon'), ('authenticated')), table_privileges(privilege_name) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) select count(*)::int as count from public_roles r cross join table_privileges p where has_table_privilege(r.role_name, to_regclass('public.google_business_connections'), p.privilege_name)"),
    client.query("with table_privileges(privilege_name) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) select count(*)::int as count from table_privileges p where has_table_privilege('service_role', to_regclass('public.google_business_connections'), p.privilege_name)"),
    client.query("select coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at' limit 1"),
    client.query("select pg_get_functiondef(p.oid) as definition, coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'homeatlas_security_posture' and p.pronargs = 0 limit 1"),
    client.query("select to_regclass('storage.buckets') is not null as exists"),
  ]);

  let agreementBucket = null;
  if (storageTable.rows[0]?.exists) {
    const bucket = await client.query("select public from storage.buckets where id = 'signed-agreements' limit 1");
    agreementBucket = bucket.rows.length ? bucket.rows[0].public : null;
  }

  const snapshot = {
    tables: new Set(tables.rows.map((row) => row.table_name)),
    columns: new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`)),
    nullableColumns: new Set(columns.rows.filter((row) => row.is_nullable === "YES").map((row) => `${row.table_name}.${row.column_name}`)),
    constraints: constraints.rows.map((row) => ({
      table_name: row.table_name,
      definition: String(row.definition),
    })),
    indexes: new Set(indexes.rows.map((row) => row.indexname)),
    enumValues: new Set(enums.rows.map((row) => `${row.type_name}.${row.value}`)),
    rlsTables: new Set(rls.rows.map((row) => row.relname)),
    referralAnonPolicies: referralPolicies.rows[0]?.count ?? 0,
    customerPublicPolicies: customerPolicies.rows[0]?.count ?? -1,
    customerPublicPrivileges: customerPrivileges.rows[0]?.count ?? -1,
    googlePublicPolicies: googlePolicies.rows[0]?.count ?? -1,
    googlePublicPrivileges: googlePublicPrivileges.rows[0]?.count ?? -1,
    googleServicePrivileges: googleServicePrivileges.rows[0]?.count ?? -1,
    googleSecurityPosture: securityPosture.rows.some((row) => String(row.definition).includes("google_business_connections") && String(row.config).includes("search_path=public")),
    secureUpdatedAt: updatedAt.rows.some((row) => String(row.config).includes("search_path=public")),
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
