#!/usr/bin/env node
/**
 * Apply 026_referral_program.sql (idempotent).
 * Usage: node scripts/migrate-referrals.mjs
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local
 * (Supabase → Settings → Database → Connection string).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
}

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = readFileSync(
  resolve(process.cwd(), "lib/persistence/supabase/migrations/026_referral_program.sql"),
  "utf8",
);
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
try {
  await client.query(sql);
  const check = await client.query(
    "select count(*) from information_schema.tables where table_name in ('referral_codes','referral_visits','referrals')",
  );
  console.log(`✓ 026 applied — referral tables present: ${check.rows[0].count}/3`);
} finally {
  await client.end();
}
