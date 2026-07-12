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
];

await client.connect();
try {
  await client.query("begin read only");

  const [tables, columns, constraints, enums, rls, referralPolicies, updatedAt, storageTable] = await Promise.all([
    client.query("select table_name from information_schema.tables where table_schema = 'public'"),
    client.query("select table_name, column_name from information_schema.columns where table_schema = 'public'"),
    client.query("select c.relname as table_name, pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'"),
    client.query("select t.typname as type_name, e.enumlabel as value from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'"),
    client.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity"),
    client.query("select count(*)::int as count from pg_policies where schemaname = 'public' and tablename in ('referral_codes', 'referral_visits', 'referrals') and ('anon' = any(roles) or 'public' = any(roles))"),
    client.query("select coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at' limit 1"),
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
    constraints: constraints.rows.map((row) => ({
      table_name: row.table_name,
      definition: String(row.definition),
    })),
    enumValues: new Set(enums.rows.map((row) => `${row.type_name}.${row.value}`)),
    rlsTables: new Set(rls.rows.map((row) => row.relname)),
    referralAnonPolicies: referralPolicies.rows[0]?.count ?? 0,
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
