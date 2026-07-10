#!/usr/bin/env node
/**
 * Post-migration 030 checks: anon vs service-role access patterns.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... npm run verify:supabase-security
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error("Could not read .env.local");
    process.exit(1);
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY");
  process.exit(1);
}

const anon = createClient(url, anonKey);
const service = serviceKey ? createClient(url, serviceKey) : null;

async function probe(label, client, table) {
  const { error } = await client.from(table).select("id").limit(1);
  return { label, table, ok: !error, error: error?.message ?? null };
}

const checks = [];

checks.push(await probe("anon", anon, "homeowners"));
checks.push(await probe("anon", anon, "closed_jobs"));
checks.push(await probe("anon", anon, "member_addon_transactions"));

if (service) {
  checks.push(await probe("service_role", service, "closed_jobs"));
  checks.push(await probe("service_role", service, "member_addon_transactions"));
} else {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping service role probes");
}

let failed = false;
for (const row of checks) {
  const status = row.ok ? "OK" : "DENIED";
  console.log(`${row.label.padEnd(14)} ${row.table.padEnd(28)} ${status}${row.error ? ` (${row.error})` : ""}`);
  if (row.label === "anon" && row.table === "homeowners" && !row.ok) failed = true;
  if (row.label === "anon" && row.table !== "homeowners" && row.ok) failed = true;
  if (row.label === "service_role" && !row.ok) failed = true;
}

if (failed) {
  console.error("\nSecurity verification failed — see docs/SUPABASE_SECURITY_ADVISOR.md");
  process.exit(1);
}

console.log("\nSecurity verification passed.");
